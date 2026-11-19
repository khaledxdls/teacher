import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { verifyToken } from './tokens.js';

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/** Authenticated requests carry the user id set by `requireAuth`. */
export type AuthedRequest = Request & { userId: string };

export function requireAuth(request: Request, _response: Response, next: NextFunction) {
  const header = request.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  const userId = scheme?.toLowerCase() === 'bearer' && token ? verifyToken(token) : null;
  if (!userId) {
    next(new HttpError(401, 'Sign in again to continue.'));
    return;
  }
  (request as AuthedRequest).userId = userId;
  next();
}

export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.');
    throw new HttpError(400, path ? `${path}: ${issue.message}` : issue?.message ?? 'Invalid request');
  }
  return result.data;
}

// Express 5 forwards rejected promises from handlers to the error handler.
export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    response.status(413).json({ error: 'Request is too large.' });
    return;
  }
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.parse.failed') {
    response.status(400).json({ error: 'Request body must be valid JSON.' });
    return;
  }
  console.error(error);
  response.status(500).json({ error: 'Something went wrong.' });
}
