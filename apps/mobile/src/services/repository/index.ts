import { createSqliteRepository } from './sqliteRepository';
import { PlannerRepository } from './types';

/** Native apps store planner data in SQLite. (The web build uses index.web.ts.) */
export const createPlannerRepository = (): PlannerRepository => createSqliteRepository();

export type { PlannerRepository } from './types';
