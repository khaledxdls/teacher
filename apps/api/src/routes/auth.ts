import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { AuthedRequest, HttpError, parseBody, requireAuth } from '../lib/http.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/tokens.js';

const credentials = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(8, 'must be at least 8 characters').max(200),
});
const registration = credentials.extend({ name: z.string().trim().max(100).optional() });

type PublicUser = { id: string; email: string; name: string | null };
const publicUser = ({ id, email, name }: PublicUser): PublicUser => ({ id, email, name });

export const authRouter = Router();

// Slow down password guessing. Disabled in tests so suites can create many accounts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

authRouter.post('/register', authLimiter, async (request, response) => {
  const input = parseBody(registration, request.body);
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new HttpError(409, 'An account with this email already exists.');
  const user = await prisma.user.create({
    data: { email: input.email, name: input.name || null, passwordHash: await hashPassword(input.password) },
  });
  response.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.post('/login', authLimiter, async (request, response) => {
  const input = parseBody(credentials, request.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Same message for unknown email and wrong password so accounts cannot be enumerated.
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  response.json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.get('/me', requireAuth, async (request, response) => {
  const user = await prisma.user.findUnique({ where: { id: (request as AuthedRequest).userId } });
  if (!user) throw new HttpError(401, 'Sign in again to continue.');
  response.json({ user: publicUser(user) });
});
