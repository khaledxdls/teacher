import { PlannerState, SyncedRecord } from './types';

/** Wire format shared with the API (`POST /sync`); keep in sync with apps/api/src/routes/sync.ts. */
export type SyncCollection =
  | 'entry' | 'class' | 'student' | 'template' | 'assessment' | 'score'
  | 'attendance' | 'homework' | 'behavior' | 'event' | 'setting';
export type SyncRecord = {
  collection: SyncCollection;
  id: string;
  updatedAt: number;
  deleted: boolean;
  data: Record<string, unknown>;
};

/** Where each synced collection lives in the planner state. */
export const COLLECTIONS = {
  entry: 'entries',
  class: 'classes',
  student: 'students',
  template: 'templates',
  assessment: 'assessments',
  score: 'scores',
  attendance: 'attendance',
  homework: 'homework',
  behavior: 'behavior',
  event: 'events',
  setting: 'settings',
} as const satisfies Record<SyncCollection, keyof PlannerState>;

const collectionNames = Object.keys(COLLECTIONS) as SyncCollection[];
type Records = SyncedRecord[];

const listOf = (state: PlannerState, collection: SyncCollection) => state[COLLECTIONS[collection]] as Records;

/** Builds a new state by transforming every collection's list. */
function mapCollections(state: PlannerState, transform: (collection: SyncCollection, records: Records) => Records): PlannerState {
  const next = { ...state } as Record<keyof PlannerState, Records>;
  for (const collection of collectionNames) next[COLLECTIONS[collection]] = transform(collection, listOf(state, collection));
  return next as unknown as PlannerState;
}

const toRecord = (collection: SyncCollection, item: SyncedRecord): SyncRecord => {
  const { updatedAt, deleted, dirty: _dirty, ...data } = item;
  return { collection, id: item.id, updatedAt, deleted: Boolean(deleted), data };
};

/** Local changes that still need to be pushed. */
export const collectDirty = (state: PlannerState): SyncRecord[] =>
  collectionNames.flatMap((collection) => listOf(state, collection)
    .filter((item) => item.dirty)
    .map((item) => toRecord(collection, item)));

export const countDirty = (state: PlannerState) =>
  collectionNames.reduce((total, collection) => total + listOf(state, collection).filter((item) => item.dirty).length, 0);

/**
 * Clears the dirty flag on records the server accepted, unless they changed again
 * while the request was in flight (their `updatedAt` moved on).
 */
export function markPushed(state: PlannerState, pushed: SyncRecord[]): PlannerState {
  if (!pushed.length) return state;
  const pushedAt = new Map(pushed.map((record) => [`${record.collection}:${record.id}`, record.updatedAt]));
  return mapCollections(state, (collection, records) => records.map((item) =>
    (item.dirty && pushedAt.get(`${collection}:${item.id}`) === item.updatedAt ? { ...item, dirty: false } : item)));
}

/** Merges server records using last-write-wins on `updatedAt`. Returns the same object if nothing changed. */
export function applyRemote(state: PlannerState, records: SyncRecord[]): PlannerState {
  const incoming = new Map<SyncCollection, SyncRecord[]>();
  for (const record of records) {
    if (!(record.collection in COLLECTIONS)) continue;
    incoming.set(record.collection, [...(incoming.get(record.collection) ?? []), record]);
  }

  let changed = false;
  const next = mapCollections(state, (collection, current) => {
    const updates = incoming.get(collection);
    if (!updates) return current;
    const list = [...current];
    for (const record of updates) {
      const index = list.findIndex((item) => item.id === record.id);
      if (index >= 0 && list[index].updatedAt >= record.updatedAt) continue;
      const merged = { ...record.data, id: record.id, updatedAt: record.updatedAt, deleted: record.deleted || undefined, dirty: false };
      if (index >= 0) list[index] = merged;
      else list.push(merged);
      changed = true;
    }
    return list;
  });
  return changed ? next : state;
}

export const markAllDirty = (state: PlannerState) =>
  mapCollections(state, (_collection, records) => records.map((item) => ({ ...item, dirty: true })));
