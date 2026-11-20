import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, bearer, change, createUser, resetDatabase, sync } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /sync', () => {
  it('requires authentication', async () => {
    await sync('invalid', 0).expect(401);
  });

  it('accepts every planner collection', async () => {
    const { token } = await createUser();
    const collections = ['entry', 'class', 'template', 'assessment', 'event', 'setting'] as const;
    const response = await sync(token, 0, collections.map((collection) => change({ id: collection, collection }))).expect(200);
    expect(response.body.changes).toHaveLength(collections.length);
  });

  it('returns nothing for a new account', async () => {
    const { token } = await createUser();
    const response = await sync(token, 0).expect(200);
    expect(response.body).toEqual({ cursor: 0, changes: [] });
  });

  it('stores pushed records and returns them to another device', async () => {
    const { token } = await createUser();
    const pushed = [change({ id: 'c1' }), change({ id: 'e1', collection: 'entry', data: { id: 'e1', subject: 'Math' } })];

    const first = await sync(token, 0, pushed).expect(200);
    expect(first.body.cursor).toBe(1);
    expect(first.body.changes).toHaveLength(2);

    const otherDevice = await sync(token, 0).expect(200);
    expect(otherDevice.body.cursor).toBe(1);
    expect(otherDevice.body.changes).toEqual(expect.arrayContaining(pushed));
  });

  it('only returns records changed after the cursor', async () => {
    const { token } = await createUser();
    const first = await sync(token, 0, [change({ id: 'c1' })]).expect(200);
    await sync(token, first.body.cursor, [change({ id: 'c2' })]).expect(200);

    const response = await sync(token, first.body.cursor).expect(200);
    expect(response.body.cursor).toBe(2);
    expect(response.body.changes.map((item: { id: string }) => item.id)).toEqual(['c2']);

    const upToDate = await sync(token, 2).expect(200);
    expect(upToDate.body.changes).toEqual([]);
  });

  it('keeps the newest version of a record (last write wins)', async () => {
    const { token } = await createUser();
    await sync(token, 0, [change({ id: 'c1', updatedAt: 2_000, data: { id: 'c1', name: 'Newer' } })]).expect(200);

    // An older edit from an offline device must not overwrite the newer one.
    await sync(token, 0, [change({ id: 'c1', updatedAt: 1_000, data: { id: 'c1', name: 'Older' } })]).expect(200);
    let stored = await sync(token, 0).expect(200);
    expect(stored.body.changes[0].data.name).toBe('Newer');

    await sync(token, 0, [change({ id: 'c1', updatedAt: 3_000, data: { id: 'c1', name: 'Newest' } })]).expect(200);
    stored = await sync(token, 0).expect(200);
    expect(stored.body.changes[0]).toMatchObject({ updatedAt: 3_000, data: { name: 'Newest' } });
  });

  it('syncs deletions as tombstones', async () => {
    const { token } = await createUser();
    const created = await sync(token, 0, [change({ id: 'c1', updatedAt: 1_000 })]).expect(200);
    await sync(token, created.body.cursor, [change({ id: 'c1', updatedAt: 2_000, deleted: true })]).expect(200);

    const response = await sync(token, created.body.cursor).expect(200);
    expect(response.body.changes).toEqual([expect.objectContaining({ id: 'c1', deleted: true })]);
  });

  it('treats a replayed request as a no-op', async () => {
    const { token } = await createUser();
    const records = [change({ id: 'c1' })];
    await sync(token, 0, records).expect(200);
    await sync(token, 0, records).expect(200);
    expect(await prisma.syncRecord.count()).toBe(1);
  });

  it('keeps users isolated, even with the same record ids', async () => {
    const alice = await createUser('alice@example.com');
    const bob = await createUser('bob@example.com');
    await sync(alice.token, 0, [change({ id: 'shared', data: { id: 'shared', name: 'Alice class' } })]).expect(200);
    await sync(bob.token, 0, [change({ id: 'shared', data: { id: 'shared', name: 'Bob class' } })]).expect(200);

    const aliceView = await sync(alice.token, 0).expect(200);
    const bobView = await sync(bob.token, 0).expect(200);
    expect(aliceView.body.changes.map((item: { data: { name: string } }) => item.data.name)).toEqual(['Alice class']);
    expect(bobView.body.changes.map((item: { data: { name: string } }) => item.data.name)).toEqual(['Bob class']);
  });

  it('returns everything when the client cursor is ahead of the server', async () => {
    const { token } = await createUser();
    await sync(token, 0, [change({ id: 'c1' })]).expect(200);
    const response = await sync(token, 99).expect(200);
    expect(response.body.cursor).toBe(1);
    expect(response.body.changes).toHaveLength(1);
  });

  it('does not lose records when devices push at the same time', async () => {
    const { token } = await createUser();
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, index) => sync(token, 0, [change({ id: `c${index}` })])),
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(new Set(responses.map((response) => response.body.cursor)).size).toBe(5);

    const all = await sync(token, 0).expect(200);
    expect(all.body.cursor).toBe(5);
    expect(all.body.changes).toHaveLength(5);
  });

  it.each([
    ['an unknown collection', { cursor: 0, changes: [{ ...change({ id: 'x' }), collection: 'users' }] }],
    ['a negative cursor', { cursor: -1, changes: [] }],
    ['a missing id', { cursor: 0, changes: [{ ...change({ id: 'x' }), id: '' }] }],
    ['too many changes', { cursor: 0, changes: Array.from({ length: 501 }, (_, index) => change({ id: `c${index}` })) }],
  ])('rejects %s', async (_, body) => {
    const { token } = await createUser();
    await api().post('/sync').set(bearer(token)).send(body).expect(400);
  });
});
