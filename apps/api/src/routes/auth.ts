import { Router } from 'express';
import { z } from 'zod';
import { limit, parseBody, requireAuth, userIdOf } from '../lib/http.js';
import type { Mailer } from '../lib/mailer.js';
import * as accounts from '../services/accounts.js';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().min(8, 'must be at least 8 characters').max(200);
const anyPassword = z.string().min(1).max(200);

const schemas = {
  register: z.object({ email, password, name: z.string().trim().max(100).optional() }),
  login: z.object({ email, password: anyPassword }),
  changePassword: z.object({ currentPassword: anyPassword, newPassword: password }),
  forgotPassword: z.object({ email }),
  resetPassword: z.object({ email, code: z.string().trim().regex(/^\d{6}$/, 'must be 6 digits'), newPassword: password }),
  deleteAccount: z.object({ password: anyPassword }),
};

export function createAuthRouter({ mailer }: { mailer: Mailer }) {
  const router = Router();
  const signInLimit = limit(20);
  const resetLimit = limit(5);

  router.post('/register', signInLimit, async (request, response) => {
    response.status(201).json(await accounts.register(parseBody(schemas.register, request.body)));
  });

  router.post('/login', signInLimit, async (request, response) => {
    response.json(await accounts.login(parseBody(schemas.login, request.body)));
  });

  router.get('/me', requireAuth, async (request, response) => {
    response.json({ user: await accounts.getUser(userIdOf(request)) });
  });

  router.delete('/me', requireAuth, async (request, response) => {
    const { password: current } = parseBody(schemas.deleteAccount, request.body);
    await accounts.deleteAccount(userIdOf(request), current);
    response.status(204).end();
  });

  router.post('/password', requireAuth, async (request, response) => {
    response.json(await accounts.changePassword(userIdOf(request), parseBody(schemas.changePassword, request.body)));
  });

  router.post('/password/forgot', resetLimit, async (request, response) => {
    await accounts.requestPasswordReset(mailer, parseBody(schemas.forgotPassword, request.body).email);
    response.status(202).json({ message: 'If an account exists for this email, a reset code is on its way.' });
  });

  router.post('/password/reset', resetLimit, async (request, response) => {
    response.json(await accounts.resetPassword(parseBody(schemas.resetPassword, request.body)));
  });

  return router;
}
