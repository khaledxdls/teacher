import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Commands, commands } from '../domain/commands';
import { todayKey } from '../domain/dates';
import { ok, Result } from '../domain/errors';
import { emptyPlannerState, PlannerState } from '../domain/types';
import { reportError } from '../services/errorReporting';
import { createPlannerRepository, PlannerRepository } from '../services/repository';
import { createStore, Store } from './store';

type BoundCommand<C> = C extends (state: PlannerState, input: infer Input, ...rest: never[]) => Result<{ value: infer Value }>
  ? (input: Input) => Result<Value>
  : never;

/** Every domain command, bound to the store: validates, applies the change and returns the result. */
export type PlannerActions = { [K in keyof Commands]: BoundCommand<Commands[K]> };

type PlannerContextValue = { store: Store<PlannerState>; actions: PlannerActions; hydrated: boolean };

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function usePlannerContext() {
  const value = useContext(PlannerContext);
  if (!value) throw new Error('Planner hooks must be used inside <PlannerProvider>');
  return value;
}

function bindCommands(store: Store<PlannerState>): PlannerActions {
  const bound = Object.fromEntries(Object.entries(commands).map(([name, command]) => [
    name,
    (input: unknown) => {
      const result = (command as (state: PlannerState, input: unknown, context: object) => Result<{ state: PlannerState; value: unknown }>)(
        store.getState(), input, { now: Date.now(), today: todayKey() },
      );
      if (!result.ok) return result;
      store.setState(() => result.value.state);
      return ok(result.value.value);
    },
  ]));
  return bound as PlannerActions;
}

/** Saves every change to the repository (only changed records are written). */
function persistChanges(store: Store<PlannerState>, repository: PlannerRepository) {
  let saved = store.getState();
  return store.subscribe(() => {
    const current = store.getState();
    repository.save(saved, current).catch((error) => reportError(error, { where: 'savePlanner' }));
    saved = current;
  });
}

/**
 * Owns all planner data. Loads it once, then saves every change. Nothing is written until
 * loading has finished, so the initial empty state can never overwrite stored data.
 */
type ProviderProps = {
  children: ReactNode;
  /** Skips loading (tests and previews). */
  initialState?: PlannerState;
  repository?: PlannerRepository;
};

export function PlannerProvider({ children, initialState, repository: injected }: ProviderProps) {
  const [repository] = useState(() => injected ?? createPlannerRepository());
  const [store] = useState(() => createStore<PlannerState>(initialState ?? emptyPlannerState));
  const [actions] = useState(() => bindCommands(store));
  const [hydrated, setHydrated] = useState(Boolean(initialState));

  useEffect(() => {
    if (initialState) return persistChanges(store, repository);
    let active = true;
    let unsubscribe = () => {};
    repository.load()
      .then((loaded) => {
        if (!active) return;
        store.setState(() => loaded);
        // Records upgraded while loading (older embedded data) are saved on the next change.
        unsubscribe = persistChanges(store, repository);
        setHydrated(true);
      })
      // Stay un-hydrated on failure so the empty in-memory state never overwrites stored data.
      .catch((error) => reportError(error, { where: 'loadPlannerState' }));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [store, initialState, repository]);

  const value = useMemo(() => ({ store, actions, hydrated }), [store, actions, hydrated]);
  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}
