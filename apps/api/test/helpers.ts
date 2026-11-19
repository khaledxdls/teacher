import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

export const api = () => request(app);

export async function resetDatabase() {
  await prisma.$executeRawUnsafe('TRUNCATE "SyncRecord", "User" CASCADE');
}

let counter = 0;

/** Registers a fresh user and returns its token. */
export async function createUser(email = `teacher${++counter}@example.com`, password = 'correct horse battery') {
  const response = await api().post('/auth/register').send({ email, password, name: 'Teacher' }).expect(201);
  return { token: response.body.token as string, user: response.body.user as { id: string; email: string } };
}

export type Change = {
  collection: 'entry' | 'class' | 'template';
  id: string;
  updatedAt: number;
  deleted: boolean;
  data: Record<string, unknown>;
};

export const change = (overrides: Partial<Change> & Pick<Change, 'id'>): Change => ({
  collection: 'class',
  updatedAt: 1_000,
  deleted: false,
  data: { id: overrides.id, name: `Class ${overrides.id}`, students: [] },
  ...overrides,
});

export function sync(token: string, cursor: number, changes: Change[] = []) {
  return api().post('/sync').set('Authorization', `Bearer ${token}`).send({ cursor, changes });
}
