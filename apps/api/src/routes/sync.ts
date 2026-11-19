import { Router } from 'express';
import { z } from 'zod';
import { AuthedRequest, parseBody, requireAuth } from '../lib/http.js';
import { syncRecords } from '../services/sync.js';

const MAX_CHANGES = 500;

const change = z.object({
  collection: z.enum(['entry', 'class', 'template']),
  id: z.string().min(1).max(100),
  updatedAt: z.number().int().nonnegative(),
  deleted: z.boolean(),
  data: z.record(z.string(), z.unknown()),
});

const syncRequest = z.object({
  cursor: z.number().int().nonnegative(),
  changes: z.array(change).max(MAX_CHANGES, `at most ${MAX_CHANGES} changes per request`),
});

export type SyncChange = z.infer<typeof change>;

export const syncRouter = Router();

/**
 * Pushes local changes and pulls everything changed since `cursor`.
 * Response: `{ cursor, changes }` where `changes` uses the same shape as the request.
 */
syncRouter.post('/', requireAuth, async (request, response) => {
  const input = parseBody(syncRequest, request.body);
  response.json(await syncRecords((request as AuthedRequest).userId, input.cursor, input.changes));
});
