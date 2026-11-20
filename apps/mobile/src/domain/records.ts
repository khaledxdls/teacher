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

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const indexById = <T extends { id: string }>(records: T[]) => new Map(records.map((record) => [record.id, record]));
