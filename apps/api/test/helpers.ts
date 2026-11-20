import request from 'supertest';
import { createApp } from '../src/app.js';
import { MemoryMailer } from '../src/lib/mailer.js';
import { prisma } from '../src/lib/prisma.js';

/** Emails "sent" by the app under test. */
export const mailer = new MemoryMailer();
const app = createApp({ mailer });

export const api = () => request(app);

export async function resetDatabase() {
  mailer.sent.length = 0;
  await prisma.$executeRawUnsafe('TRUNCATE "PasswordReset", "SyncRecord", "User" CASCADE');
}

export const DEFAULT_PASSWORD = 'correct horse battery';
let counter = 0;

/** Registers a fresh user and returns its token. */
export async function createUser(email = `teacher${++counter}@example.com`, password = DEFAULT_PASSWORD) {
  const response = await api().post('/auth/register').send({ email, password, name: 'Teacher' }).expect(201);
  return { token: response.body.token as string, user: response.body.user as { id: string; email: string } };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export type Change = {
  collection: 'entry' | 'class' | 'template' | 'assessment' | 'event' | 'setting';
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
  return api().post('/sync').set(bearer(token)).send({ cursor, changes });
}

/** Extracts the 6-digit code from the last password reset email. */
export function lastResetCode() {
  const match = mailer.last()?.text.match(/\b(\d{6})\b/);
  if (!match) throw new Error('No reset code was emailed');
  return match[1];
}
