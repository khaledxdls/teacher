import { NextFunction, Request, RequestHandler, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { captureException } from './monitoring.js';
import { prisma } from './prisma.js';
import { verifyToken } from './tokens.js';

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export const unauthorized = () => new HttpError(401, 'Sign in again to continue.');

/** Authenticated requests carry the user id set by `requireAuth`. */
export type AuthedRequest = Request & { userId: string };
export const userIdOf = (request: Request) => (request as AuthedRequest).userId;

function bearerToken(request: Request) {
  const [scheme, token] = (request.header('authorization') ?? '').split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * Accepts a valid bearer token whose version matches the user's current `tokenVersion`,
 * so changing or resetting the password signs out every other device.
 */
export const requireAuth: RequestHandler = async (request, _response, next) => {
  const token = bearerToken(request);
  const claims = token ? verifyToken(token) : null;
  if (!claims) throw unauthorized();
  const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: { tokenVersion: true } });
  if (!user || user.tokenVersion !== claims.tokenVersion) throw unauthorized();
  (request as AuthedRequest).userId = claims.userId;
  next();
};

/** Like `requireAuth` but lets anonymous requests through (userId stays undefined). */
export const optionalAuth: RequestHandler = async (request, response, next) => {
  if (!bearerToken(request)) {
    next();
    return;
  }
  try {
    await requireAuth(request, response, next);
  } catch {
    next();
  }
};

export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.');
    throw new HttpError(400, path ? `${path}: ${issue.message}` : issue?.message ?? 'Invalid request');
  }
  return result.data;
}

/** Per-IP rate limit. Disabled in tests so suites can make many requests. */
export const limit = (max: number, windowMinutes = 15) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  limit: max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

const hasType = (error: unknown, type: string) =>
  Boolean(error && typeof error === 'object' && 'type' in error && error.type === type);

// Express 5 forwards rejected promises from handlers to the error handler.
export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (hasType(error, 'entity.too.large')) {
    response.status(413).json({ error: 'Request is too large.' });
    return;
  }
  if (hasType(error, 'entity.parse.failed')) {
    response.status(400).json({ error: 'Request body must be valid JSON.' });
    return;
  }
  console.error(error);
  captureException(error, { method: request.method, path: request.path });
  response.status(500).json({ error: 'Something went wrong.' });
}
