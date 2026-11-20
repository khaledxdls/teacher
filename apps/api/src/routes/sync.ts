import { Router } from 'express';
import { z } from 'zod';
import { parseBody, requireAuth, userIdOf } from '../lib/http.js';
import { syncRecords } from '../services/sync.js';

const MAX_CHANGES = 500;

/** Keep in sync with `SyncCollection` in the mobile app (apps/mobile/src/domain/sync.ts). */
export const SYNC_COLLECTIONS = ['entry', 'class', 'template', 'assessment', 'event', 'setting'] as const;

const change = z.object({
  collection: z.enum(SYNC_COLLECTIONS),
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

export function createSyncRouter() {
  const router = Router();

  /**
   * Pushes local changes and pulls everything changed since `cursor`.
   * Response: `{ cursor, changes }` where `changes` uses the same shape as the request.
   */
  router.post('/', requireAuth, async (request, response) => {
    const input = parseBody(syncRequest, request.body);
    response.json(await syncRecords(userIdOf(request), input.cursor, input.changes));
  });

  return router;
}
