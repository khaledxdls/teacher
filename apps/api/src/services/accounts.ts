import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { User } from '@prisma/client';
import { config } from '../config.js';
import { HttpError } from '../lib/http.js';
import type { Mailer } from '../lib/mailer.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/tokens.js';

export type PublicUser = { id: string; email: string; name: string | null };
export type Session = { token: string; user: PublicUser };

const toPublicUser = ({ id, email, name }: User): PublicUser => ({ id, email, name });
const sessionFor = (user: User): Session => ({ token: signToken(user.id, user.tokenVersion), user: toPublicUser(user) });

const invalidCredentials = () => new HttpError(401, 'Email or password is incorrect.');
const invalidResetCode = () => new HttpError(400, 'This code is invalid or has expired. Request a new one.');

/** Reset codes are short, so they are stored as a keyed hash rather than a slow password hash. */
const hashCode = (code: string) => createHmac('sha256', config.jwtSecret).update(code).digest('hex');
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function register(input: { email: string; password: string; name?: string }): Promise<Session> {
  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw new HttpError(409, 'An account with this email already exists.');
  }
  const user = await prisma.user.create({
    data: { email: input.email, name: input.name || null, passwordHash: await hashPassword(input.password) },
  });
  return sessionFor(user);
}

export async function login(input: { email: string; password: string }): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Same error for unknown email and wrong password so accounts cannot be enumerated.
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw invalidCredentials();
  return sessionFor(user);
}

export async function getUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, 'Sign in again to continue.');
  return toPublicUser(user);
}

async function requirePassword(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, 'Sign in again to continue.');
  if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(403, 'Your current password is incorrect.');
  return user;
}

/** Sets a new password and signs out every other device. Returns a fresh session for this device. */
async function setPassword(userId: string, newPassword: string): Promise<Session> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
  });
  return sessionFor(user);
}

export async function changePassword(userId: string, input: { currentPassword: string; newPassword: string }) {
  await requirePassword(userId, input.currentPassword);
  return setPassword(userId, input.newPassword);
}

/** Permanently deletes the account and all synced data (records and reset codes cascade). */
export async function deleteAccount(userId: string, password: string) {
  await requirePassword(userId, password);
  await prisma.user.delete({ where: { id: userId } });
}

/**
 * Emails a 6-digit reset code. Always succeeds from the caller's point of view so the
 * response does not reveal whether the email has an account.
 */
export async function requestPasswordReset(mailer: Mailer, email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const { codeTtlMinutes } = config.passwordReset;
  await prisma.$transaction([
    // Only the newest code is valid.
    prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordReset.create({
      data: { userId: user.id, codeHash: hashCode(code), expiresAt: new Date(Date.now() + codeTtlMinutes * 60_000) },
    }),
  ]);

  await mailer.send({
    to: user.email,
    subject: 'Your ClassPilot password reset code',
    text: [
      `Your password reset code is ${code}.`,
      `It expires in ${codeTtlMinutes} minutes.`,
      'If you did not ask to reset your password, you can ignore this email.',
    ].join('\n\n'),
  });
}

export async function resetPassword(input: { email: string; code: string; newPassword: string }): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw invalidResetCode();

  const reset = await prisma.passwordReset.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!reset || reset.attempts >= config.passwordReset.maxAttempts) throw invalidResetCode();

  if (!sameHash(reset.codeHash, hashCode(input.code))) {
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
    throw invalidResetCode();
  }

  await prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
  return setPassword(user.id, input.newPassword);
}
