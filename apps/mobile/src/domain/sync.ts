import { PlannerState, SyncMeta } from './schedule';

/** Wire format shared with the API (`POST /sync`). */
export type SyncCollection = 'entry' | 'class' | 'template';
export type SyncRecord = {
  collection: SyncCollection;
  id: string;
  updatedAt: number;
  deleted: boolean;
  data: Record<string, unknown>;
};

const collections = { entry: 'entries', class: 'classes', template: 'templates' } as const;
type StateKey = (typeof collections)[SyncCollection];

const toRecord = (collection: SyncCollection, item: SyncMeta & { id: string }): SyncRecord => {
  const { updatedAt, deleted, dirty: _dirty, ...data } = item;
  return { collection, id: item.id, updatedAt, deleted: Boolean(deleted), data };
};

/** Local changes that still need to be pushed. */
export function collectDirty(state: PlannerState): SyncRecord[] {
  return (Object.keys(collections) as SyncCollection[]).flatMap((collection) =>
    (state[collections[collection]] as (SyncMeta & { id: string })[])
      .filter((item) => item.dirty)
      .map((item) => toRecord(collection, item)));
}

/**
 * Clears the dirty flag on records the server accepted, unless they changed again
 * while the request was in flight (their `updatedAt` moved on).
 */
export function markPushed(state: PlannerState, pushed: SyncRecord[]): PlannerState {
  if (!pushed.length) return state;
  const pushedAt = new Map(pushed.map((record) => [`${record.collection}:${record.id}`, record.updatedAt]));
  const clean = <T extends SyncMeta & { id: string }>(collection: SyncCollection, items: T[]) =>
    items.map((item) => (item.dirty && pushedAt.get(`${collection}:${item.id}`) === item.updatedAt ? { ...item, dirty: false } : item));
  return {
    entries: clean('entry', state.entries),
    classes: clean('class', state.classes),
    templates: clean('template', state.templates),
  };
}

/** Merges server records using last-write-wins on `updatedAt`. Returns the same object if nothing changed. */
export function applyRemote(state: PlannerState, records: SyncRecord[]): PlannerState {
  let changed = false;
  const next: Record<StateKey, (SyncMeta & { id: string })[]> = {
    entries: [...state.entries], classes: [...state.classes], templates: [...state.templates],
  };
  for (const record of records) {
    const key = collections[record.collection];
    if (!key) continue;
    const list = next[key];
    const index = list.findIndex((item) => item.id === record.id);
    if (index >= 0 && list[index].updatedAt >= record.updatedAt) continue;
    const merged = { ...record.data, id: record.id, updatedAt: record.updatedAt, deleted: record.deleted || undefined, dirty: false };
    if (index >= 0) list[index] = merged;
    else list.push(merged);
    changed = true;
  }
  return changed ? (next as unknown as PlannerState) : state;
}

export function markAllDirty(state: PlannerState): PlannerState {
  const dirty = <T extends SyncMeta>(items: T[]) => items.map((item) => ({ ...item, dirty: true }));
  return { entries: dirty(state.entries), classes: dirty(state.classes), templates: dirty(state.templates) };
}
