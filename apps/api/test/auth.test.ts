import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, createUser, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /auth/register', () => {
  it('creates an account and returns a token without the password hash', async () => {
    const response = await api().post('/auth/register')
      .send({ email: ' Teacher@Example.com ', password: 'correct horse battery', name: 'Ms Smith' })
      .expect(201);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user).toEqual({ id: expect.any(String), email: 'teacher@example.com', name: 'Ms Smith' });

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'teacher@example.com' } });
    expect(stored.passwordHash).toMatch(/^scrypt\$/);
    expect(stored.passwordHash).not.toContain('correct horse');
  });

  it('rejects duplicate emails case-insensitively', async () => {
    await createUser('teacher@example.com');
    const response = await api().post('/auth/register').send({ email: 'TEACHER@example.com', password: 'another password' }).expect(409);
    expect(response.body.error).toMatch(/already exists/);
  });

  it.each([
    [{ email: 'not-an-email', password: 'long enough password' }, /email/],
    [{ email: 'teacher@example.com', password: 'short' }, /password: must be at least 8/],
    [{ email: 'teacher@example.com' }, /password/],
  ])('validates input %#', async (body, message) => {
    const response = await api().post('/auth/register').send(body).expect(400);
    expect(response.body.error).toMatch(message);
  });

  it('rejects malformed JSON', async () => {
    await api().post('/auth/register').set('Content-Type', 'application/json').send('{bad json').expect(400);
  });
});

describe('POST /auth/login', () => {
  it('returns a token for the right password', async () => {
    const { user } = await createUser('teacher@example.com', 'correct horse battery');
    const response = await api().post('/auth/login').send({ email: 'teacher@example.com', password: 'correct horse battery' }).expect(200);
    expect(response.body.user.id).toBe(user.id);
    expect(response.body.token).toEqual(expect.any(String));
  });

  it('uses the same error for a wrong password and an unknown email', async () => {
    await createUser('teacher@example.com', 'correct horse battery');
    const wrongPassword = await api().post('/auth/login').send({ email: 'teacher@example.com', password: 'wrong password!' }).expect(401);
    const unknownEmail = await api().post('/auth/login').send({ email: 'nobody@example.com', password: 'wrong password!' }).expect(401);
    expect(wrongPassword.body.error).toBe('Email or password is incorrect.');
    expect(unknownEmail.body.error).toBe(wrongPassword.body.error);
  });
});

describe('GET /auth/me', () => {
  it('returns the signed-in user', async () => {
    const { token, user } = await createUser();
    const response = await api().get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(response.body.user.id).toBe(user.id);
  });

  it.each([
    ['no header', undefined],
    ['a malformed token', 'Bearer nope'],
    ['a different scheme', 'Basic abc'],
  ])('rejects requests with %s', async (_, header) => {
    const req = api().get('/auth/me');
    if (header) req.set('Authorization', header);
    await req.expect(401);
  });

  it('rejects tokens of deleted users', async () => {
    const { token, user } = await createUser();
    await prisma.user.delete({ where: { id: user.id } });
    await api().get('/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });
});

describe('misc', () => {
  it('reports health with the database connected', async () => {
    const response = await api().get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', database: 'connected' });
  });

  it('returns JSON 404s', async () => {
    const response = await api().get('/nope').expect(404);
    expect(response.body).toEqual({ error: 'Not found' });
  });
});
