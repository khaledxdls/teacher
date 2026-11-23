import { PlannerState, SyncedRecord } from '../../domain/types';

/** Where planner data is stored on the device. */
export interface PlannerRepository {
  load(): Promise<PlannerState>;
  /** Persists what changed between two states (records are replaced immutably, so identity tells). */
  save(previous: PlannerState, next: PlannerState): Promise<void>;
}

export type CollectionName = keyof PlannerState;
export type RecordChange = { collection: CollectionName; record: SyncedRecord };

/** Records that are new or replaced in `next` compared with `previous`. */
export function changedRecords(previous: PlannerState, next: PlannerState): RecordChange[] {
  const changes: RecordChange[] = [];
  for (const collection of Object.keys(next) as CollectionName[]) {
    const before = previous[collection] as SyncedRecord[] | undefined;
    const after = next[collection] as SyncedRecord[];
    if (before === after) continue;
    const previousById = new Map((before ?? []).map((record) => [record.id, record]));
    for (const record of after) {
      if (previousById.get(record.id) !== record) changes.push({ collection, record });
    }
  }
  return changes;
}

/** Collections whose array changed (for stores that write whole collections). */
export const changedCollections = (previous: PlannerState, next: PlannerState) =>
  (Object.keys(next) as CollectionName[]).filter((name) => previous[name] !== next[name]);
