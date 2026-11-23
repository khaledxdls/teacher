import { upgradeEmbeddedRecords } from '../../domain/migrations';
import { PlannerState } from '../../domain/types';
import { loadPlannerState, saveCollection } from '../storage';
import { changedCollections, PlannerRepository } from './types';

/**
 * Stores each collection as one JSON value in AsyncStorage. Used on the web (where SQLite
 * needs extra hosting setup) and as the source when migrating to SQLite.
 */
export function createKeyValueRepository(): PlannerRepository {
  const save = async (previous: PlannerState, next: PlannerState) => {
    await Promise.all(changedCollections(previous, next).map((name) => saveCollection(name, next[name])));
  };
  return {
    async load() {
      const stored = await loadPlannerState();
      const upgraded = upgradeEmbeddedRecords(stored, Date.now());
      await save(stored, upgraded);
      return upgraded;
    },
    save,
  };
}
