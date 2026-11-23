import { emptyPlannerState, PlannerState } from '../domain/types';
import { PlannerRepository } from '../services/repository/types';

/** An in-memory repository for tests: records what was saved and loads `initial`. */
export function createMemoryRepository(initial: PlannerState = emptyPlannerState) {
  const saves: { previous: PlannerState; next: PlannerState }[] = [];
  const repository: PlannerRepository & { saves: typeof saves; load: jest.Mock } = {
    saves,
    load: jest.fn(async () => initial),
    async save(previous, next) {
      saves.push({ previous, next });
    },
  };
  return repository;
}
