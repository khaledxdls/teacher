import { SyncedRecord, SyncMeta } from './types';

export const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Marks a record as changed locally at `now`. */
export const touch = <T extends SyncMeta>(record: T, now: number): T => ({ ...record, updatedAt: now, dirty: true });

/** Replaces a record with a tombstone so the deletion syncs. */
export const tombstone = <T extends SyncMeta>(record: T, now: number): T => ({ ...touch(record, now), deleted: true });

export const alive = <T extends SyncMeta>(records: T[]) => records.filter((record) => !record.deleted);

export const findLive = <T extends SyncedRecord>(records: T[], id: string) =>
  records.find((record) => record.id === id && !record.deleted);

/** Inserts the record, or replaces the one with the same id. */
export const upsert = <T extends SyncedRecord>(records: T[], record: T) =>
  records.some((item) => item.id === record.id)
    ? records.map((item) => (item.id === record.id ? record : item))
    : [...records, record];

/** Applies `update` to the record with `id` and marks it changed. */
export const updateById = <T extends SyncedRecord>(records: T[], id: string, update: (record: T) => T, now: number) =>
  records.map((item) => (item.id === id ? touch(update(item), now) : item));

export const removeById = <T extends SyncedRecord>(records: T[], id: string, now: number) =>
  records.map((item) => (item.id === id ? tombstone(item, now) : item));

/**
 * Sets or clears a record with a deterministic id (e.g. one attendance mark per lesson
 * and student). `fields === null` turns an existing record into a tombstone.
 */
export function setPairRecord<T extends SyncedRecord>(records: T[], id: string, fields: Omit<T, keyof SyncedRecord> | null, now: number): T[] {
  const existing = records.find((item) => item.id === id);
  if (fields === null) return existing && !existing.deleted ? records.map((item) => (item.id === id ? tombstone(item, now) : item)) : records;
  const record = { ...fields, id, updatedAt: now, dirty: true } as T;
  return existing ? records.map((item) => (item.id === id ? record : item)) : [...records, record];
}

/** Live records grouped by a key, e.g. students by class id. */
export function groupBy<T extends SyncMeta, K>(records: T[], key: (record: T) => K) {
  const groups = new Map<K, T[]>();
  for (const record of records) {
    if (record.deleted) continue;
    const groupKey = key(record);
    const group = groups.get(groupKey);
    if (group) group.push(record);
    else groups.set(groupKey, [record]);
  }
  return groups;
}

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const indexById = <T extends { id: string }>(records: T[]) => new Map(records.map((record) => [record.id, record]));
