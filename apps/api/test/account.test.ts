import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, bearer, change, createUser, DEFAULT_PASSWORD, lastResetCode, mailer, resetDatabase, sync } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const NEW_PASSWORD = 'a brand new passphrase';

describe('POST /auth/password (change password)', () => {
  it('changes the password, returns a new token and signs out other devices', async () => {
    const { token: oldToken, user } = await createUser('teacher@example.com');
    const response = await api().post('/auth/password').set(bearer(oldToken))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: NEW_PASSWORD })
      .expect(200);

    expect(response.body.user.id).toBe(user.id);
    await api().get('/auth/me').set(bearer(response.body.token)).expect(200);
    await api().get('/auth/me').set(bearer(oldToken)).expect(401);

    await api().post('/auth/login').send({ email: 'teacher@example.com', password: DEFAULT_PASSWORD }).expect(401);
    await api().post('/auth/login').send({ email: 'teacher@example.com', password: NEW_PASSWORD }).expect(200);
  });

  it('requires the current password', async () => {
    const { token } = await createUser();
    const response = await api().post('/auth/password').set(bearer(token))
      .send({ currentPassword: 'wrong password', newPassword: NEW_PASSWORD })
      .expect(403);
    expect(response.body.error).toBe('Your current password is incorrect.');
  });

  it('validates the new password', async () => {
    const { token } = await createUser();
    await api().post('/auth/password').set(bearer(token)).send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'short' }).expect(400);
  });
});

describe('password reset', () => {
  it('emails a code that resets the password once', async () => {
    const { token: oldToken } = await createUser('teacher@example.com');
    await api().post('/auth/password/forgot').send({ email: 'TEACHER@example.com' }).expect(202);

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.last()).toMatchObject({ to: 'teacher@example.com', subject: expect.stringContaining('reset') });
    const code = lastResetCode();

    const reset = await api().post('/auth/password/reset')
      .send({ email: 'teacher@example.com', code, newPassword: NEW_PASSWORD })
      .expect(200);
    expect(reset.body.token).toEqual(expect.any(String));

    // Old sessions end, the new password works and the code cannot be reused.
    await api().get('/auth/me').set(bearer(oldToken)).expect(401);
    await api().post('/auth/login').send({ email: 'teacher@example.com', password: NEW_PASSWORD }).expect(200);
    await api().post('/auth/password/reset').send({ email: 'teacher@example.com', code, newPassword: 'yet another passphrase' }).expect(400);
  });

  it('responds the same way for unknown emails and sends nothing', async () => {
    const response = await api().post('/auth/password/forgot').send({ email: 'nobody@example.com' }).expect(202);
    expect(response.body.message).toMatch(/If an account exists/);
    expect(mailer.sent).toHaveLength(0);
  });

  it('only accepts the newest code', async () => {
    await createUser('teacher@example.com');
    await api().post('/auth/password/forgot').send({ email: 'teacher@example.com' }).expect(202);
    const first = lastResetCode();
    await api().post('/auth/password/forgot').send({ email: 'teacher@example.com' }).expect(202);
    const second = lastResetCode();
    if (first === second) return; // 1-in-a-million collision; nothing to assert.

    await api().post('/auth/password/reset').send({ email: 'teacher@example.com', code: first, newPassword: NEW_PASSWORD }).expect(400);
    await api().post('/auth/password/reset').send({ email: 'teacher@example.com', code: second, newPassword: NEW_PASSWORD }).expect(200);
  });

  it('locks the code after too many wrong guesses', async () => {
    await createUser('teacher@example.com');
    await api().post('/auth/password/forgot').send({ email: 'teacher@example.com' }).expect(202);
    const code = lastResetCode();
    const wrong = code === '000000' ? '111111' : '000000';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await api().post('/auth/password/reset').send({ email: 'teacher@example.com', code: wrong, newPassword: NEW_PASSWORD }).expect(400);
    }
    await api().post('/auth/password/reset').send({ email: 'teacher@example.com', code, newPassword: NEW_PASSWORD }).expect(400);
  });

  it('rejects expired codes', async () => {
    await createUser('teacher@example.com');
    await api().post('/auth/password/forgot').send({ email: 'teacher@example.com' }).expect(202);
    await prisma.passwordReset.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await api().post('/auth/password/reset').send({ email: 'teacher@example.com', code: lastResetCode(), newPassword: NEW_PASSWORD }).expect(400);
  });

  it.each([
    [{ email: 'teacher@example.com', code: '12345', newPassword: NEW_PASSWORD }, /code: must be 6 digits/],
    [{ email: 'teacher@example.com', code: '123456', newPassword: 'short' }, /newPassword/],
  ])('validates input %#', async (body, message) => {
    const response = await api().post('/auth/password/reset').send(body).expect(400);
    expect(response.body.error).toMatch(message);
  });
});

describe('DELETE /auth/me (delete account)', () => {
  it('deletes the account and all synced data after confirming the password', async () => {
    const { token, user } = await createUser('teacher@example.com');
    await sync(token, 0, [change({ id: 'c1' })]).expect(200);
    await api().post('/auth/password/forgot').send({ email: 'teacher@example.com' }).expect(202);

    await api().delete('/auth/me').set(bearer(token)).send({ password: DEFAULT_PASSWORD }).expect(204);

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.syncRecord.count()).toBe(0);
    expect(await prisma.passwordReset.count()).toBe(0);
    await api().get('/auth/me').set(bearer(token)).expect(401);
    // The email can be used for a new account afterwards.
    await createUser('teacher@example.com');
  });

  it('requires the password', async () => {
    const { token } = await createUser();
    await api().delete('/auth/me').set(bearer(token)).send({ password: 'wrong password' }).expect(403);
    await api().delete('/auth/me').set(bearer(token)).send({}).expect(400);
    await api().get('/auth/me').set(bearer(token)).expect(200);
  });
});

describe('POST /client-errors', () => {
  it('accepts reports with or without a session', async () => {
    const { token } = await createUser();
    await api().post('/client-errors').send({ message: 'Boom', context: { platform: 'ios' } }).expect(202);
    await api().post('/client-errors').set(bearer(token)).send({ message: 'Boom', stack: 'at x' }).expect(202);
    // An invalid token does not block the report.
    await api().post('/client-errors').set(bearer('nope')).send({ message: 'Boom' }).expect(202);
  });

  it('validates reports', async () => {
    await api().post('/client-errors').send({ message: '' }).expect(400);
    await api().post('/client-errors').send({ message: 'x', context: { nested: { a: 1 } } }).expect(400);
  });
});
