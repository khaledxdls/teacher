import { createKeyValueRepository } from './keyValueRepository';
import { PlannerRepository } from './types';

/** The web build keeps planner data in browser storage (SQLite on web needs special hosting headers). */
export const createPlannerRepository = (): PlannerRepository => createKeyValueRepository();

export type { PlannerRepository } from './types';
