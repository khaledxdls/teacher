import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';
import { upgradeEmbeddedRecords } from '../../domain/migrations';
import { emptyPlannerState, PlannerState, SyncedRecord } from '../../domain/types';
import { loadPlannerState as loadKeyValueState } from '../storage';
import { changedRecords, CollectionName, PlannerRepository, RecordChange } from './types';

const DATABASE_NAME = 'classpilot.db';
const MIGRATED_FROM_KEY_VALUE = 'migratedFromKeyValue';

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS records (
    collection TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (collection, id)
  );
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
`;

const UPSERT = 'INSERT INTO records (collection, id, data) VALUES (?, ?, ?) ON CONFLICT (collection, id) DO UPDATE SET data = excluded.data';

/**
 * Stores every record as one row, so saving a change writes only that record instead of
 * rewriting whole collections. Data from the AsyncStorage version is copied over once
 * (the old keys are left as a backup).
 */
export function createSqliteRepository(): PlannerRepository {
  let database: Promise<SQLiteDatabase> | null = null;
  // Writes run one after another so a later save never lands before an earlier one.
  let queue: Promise<unknown> = Promise.resolve();

  const open = () => {
    database ??= openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync(SCHEMA);
      return db;
    });
    return database;
  };

  async function write(db: SQLiteDatabase, changes: RecordChange[]) {
    if (!changes.length) return;
    await db.withTransactionAsync(async () => {
      for (const { collection, record } of changes) {
        await db.runAsync(UPSERT, collection, record.id, JSON.stringify(record));
      }
    });
  }

  async function migrateFromKeyValue(db: SQLiteDatabase) {
    const done = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', MIGRATED_FROM_KEY_VALUE);
    if (done) return;
    const legacy = await loadKeyValueState();
    await write(db, changedRecords(emptyPlannerState, legacy));
    await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', MIGRATED_FROM_KEY_VALUE, new Date().toISOString());
  }

  return {
    async load() {
      const db = await open();
      await migrateFromKeyValue(db);
      const rows = await db.getAllAsync<{ collection: string; data: string }>('SELECT collection, data FROM records');
      const collections: Partial<Record<CollectionName, SyncedRecord[]>> = {};
      for (const row of rows) {
        if (!(row.collection in emptyPlannerState)) continue;
        try {
          (collections[row.collection as CollectionName] ??= []).push(JSON.parse(row.data));
        } catch {
          console.warn(`Skipping a corrupted ${row.collection} record`);
        }
      }
      // Rows are JSON written by this app, so they have the record shapes of their collection.
      const stored = { ...emptyPlannerState, ...collections } as PlannerState;
      // Older embedded data (e.g. students inside classes) becomes separate records, saved right away.
      const upgraded = upgradeEmbeddedRecords(stored, Date.now());
      await write(db, changedRecords(stored, upgraded));
      return upgraded;
    },

    save(previous, next) {
      const changes = changedRecords(previous, next);
      const run = queue.then(async () => write(await open(), changes));
      queue = run.catch(() => undefined);
      return run;
    },
  };
}
