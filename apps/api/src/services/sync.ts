import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import type { SyncChange } from '../routes/sync.js';

type SyncResult = { cursor: number; changes: SyncChange[] };

const toChange = (record: { collection: string; id: string; data: Prisma.JsonValue; deleted: boolean; clientUpdatedAt: Date }): SyncChange => ({
  collection: record.collection as SyncChange['collection'],
  id: record.id,
  updatedAt: record.clientUpdatedAt.getTime(),
  deleted: record.deleted,
  data: (record.data ?? {}) as Record<string, unknown>,
});

/**
 * Applies `changes` with last-write-wins on `updatedAt`, then returns every record
 * written after `cursor` (including the ones just written).
 *
 * Writes for one user are serialized by incrementing `User.syncVersion` first, which
 * row-locks the user until the transaction commits. Every record written gets that
 * version, and pulls only return records up to the version read at the start, so a
 * client never skips a record that commits later.
 */
export async function syncRecords(userId: string, cursor: number, changes: SyncChange[]): Promise<SyncResult> {
  return prisma.$transaction(async (tx) => {
    let version: number;

    if (changes.length) {
      const user = await tx.user.update({ where: { id: userId }, data: { syncVersion: { increment: 1 } } })
        .catch(() => { throw new HttpError(401, 'Sign in again to continue.'); });
      version = user.syncVersion;

      for (const item of changes) {
        const key = { userId_collection_id: { userId, collection: item.collection, id: item.id } };
        const existing = await tx.syncRecord.findUnique({ where: key, select: { clientUpdatedAt: true } });
        // Ties keep the stored value so a replayed request is a no-op.
        if (existing && existing.clientUpdatedAt.getTime() >= item.updatedAt) continue;
        const data = {
          data: item.data as Prisma.InputJsonValue,
          deleted: item.deleted,
          clientUpdatedAt: new Date(item.updatedAt),
          version,
        };
        await tx.syncRecord.upsert({
          where: key,
          create: { userId, collection: item.collection, id: item.id, ...data },
          update: data,
        });
      }
    } else {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { syncVersion: true } });
      if (!user) throw new HttpError(401, 'Sign in again to continue.');
      version = user.syncVersion;
    }

    // A cursor ahead of the server (e.g. after a database reset) means the client must pull everything.
    const from = cursor > version ? 0 : cursor;
    const records = await tx.syncRecord.findMany({
      where: { userId, version: { gt: from, lte: version } },
      orderBy: { version: 'asc' },
    });
    return { cursor: version, changes: records.map(toChange) };
  }, { timeout: 20_000 });
}
