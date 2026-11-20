import { Router } from 'express';
import { z } from 'zod';
import { limit, optionalAuth, parseBody } from '../lib/http.js';
import { captureMessage } from '../lib/monitoring.js';

const report = z.object({
  message: z.string().min(1).max(1_000),
  stack: z.string().max(10_000).optional(),
  /** Free-form tags such as platform, app version or the screen. */
  context: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

/**
 * Receives crash and error reports from the app and forwards them to monitoring.
 * Routing them through the API keeps the app free of native monitoring SDKs (works in Expo Go).
 */
export function createClientErrorsRouter() {
  const router = Router();

  router.post('/', limit(60), optionalAuth, async (request, response) => {
    const input = parseBody(report, request.body);
    const userId = (request as { userId?: string }).userId;
    console.warn(`[client-error] ${input.message}`, { userId, ...input.context });
    captureMessage(`[app] ${input.message}`, { stack: input.stack, userId, ...input.context });
    response.status(202).end();
  });

  return router;
}
