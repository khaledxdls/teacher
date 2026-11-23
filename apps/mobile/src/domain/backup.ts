import { fail, ok, Result } from './errors';
import { normalizeState, upgradeEmbeddedRecords } from './migrations';
import { emptyPlannerState, PlannerState, SyncedRecord } from './types';

export const BACKUP_FORMAT = 'classpilot-backup';
export const BACKUP_VERSION = 1;

type BackupFile = { format: typeof BACKUP_FORMAT; version: number; exportedAt: string; data: Partial<PlannerState> };

const collectionNames = Object.keys(emptyPlannerState) as (keyof PlannerState)[];

/** Serializes all planner data (including deletions, so restoring elsewhere stays consistent). */
export function createBackup(state: PlannerState, now: Date): string {
  const data = Object.fromEntries(collectionNames.map((name) => [
    name,
    (state[name] as SyncedRecord[]).map(({ dirty: _dirty, ...record }) => record),
  ]));
  const file: BackupFile = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
  return JSON.stringify(file);
}

const isRecord = (value: unknown): value is SyncedRecord =>
  typeof value === 'object' && value !== null && typeof (value as SyncedRecord).id === 'string' && typeof (value as SyncedRecord).updatedAt === 'number';

/** Validates a backup file and returns its data in the current format. */
export function parseBackup(text: string): Result<PlannerState> {
  let file: BackupFile;
  try {
    file = JSON.parse(text);
  } catch {
    return fail('backupInvalid');
  }
  if (file?.format !== BACKUP_FORMAT || typeof file.version !== 'number' || file.version > BACKUP_VERSION || typeof file.data !== 'object' || !file.data) {
    return fail('backupInvalid');
  }
  const data = Object.fromEntries(collectionNames.map((name) => {
    const list = (file.data as Record<string, unknown>)[name];
    return [name, Array.isArray(list) ? list.filter(isRecord) : []];
  }));
  return ok(normalizeState(data));
}

export type MergeSummary = { added: number; updated: number };

/**
 * Merges backup data into the current data, keeping the newest version of every record
 * (nothing newer on this device is overwritten). Imported changes are marked for sync.
 */
export function mergeBackup(state: PlannerState, incoming: PlannerState, now: number): { state: PlannerState; summary: MergeSummary } {
  const summary: MergeSummary = { added: 0, updated: 0 };
  const merged = { ...state } as Record<keyof PlannerState, SyncedRecord[]>;
  for (const name of collectionNames) {
    const current = state[name] as SyncedRecord[];
    const byId = new Map(current.map((record, index) => [record.id, index]));
    const list = [...current];
    for (const record of incoming[name] as SyncedRecord[]) {
      const index = byId.get(record.id);
      if (index === undefined) {
        list.push({ ...record, dirty: true });
        byId.set(record.id, list.length - 1);
        summary.added += 1;
      } else if (list[index].updatedAt < record.updatedAt) {
        list[index] = { ...record, dirty: true };
        summary.updated += 1;
      }
    }
    merged[name] = list;
  }
  return { state: upgradeEmbeddedRecords(merged as unknown as PlannerState, now), summary };
}
