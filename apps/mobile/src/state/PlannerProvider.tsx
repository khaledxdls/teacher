import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Commands, commands } from '../domain/commands';
import { todayKey } from '../domain/dates';
import { ok, Result } from '../domain/errors';
import { emptyPlannerState, PlannerState } from '../domain/types';
import { reportError } from '../services/errorReporting';
import { loadPlannerState, saveCollection } from '../services/storage';
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

const collectionNames = Object.keys(emptyPlannerState) as (keyof PlannerState)[];

/** Saves each collection whose array changed since the last save. */
function persistChanges(store: Store<PlannerState>) {
  let saved = store.getState();
  return store.subscribe(() => {
    const current = store.getState();
    for (const name of collectionNames) {
      if (current[name] !== saved[name]) {
        saveCollection(name, current[name]).catch((error) => reportError(error, { where: `save:${name}` }));
      }
    }
    saved = current;
  });
}

/**
 * Owns all planner data. Loads it once, then saves every change. Nothing is written until
 * loading has finished, so the initial empty state can never overwrite stored data.
 */
export function PlannerProvider({ children, initialState }: { children: ReactNode; initialState?: PlannerState }) {
  const [store] = useState(() => createStore<PlannerState>(initialState ?? emptyPlannerState));
  const [actions] = useState(() => bindCommands(store));
  const [hydrated, setHydrated] = useState(Boolean(initialState));

  useEffect(() => {
    if (initialState) return persistChanges(store);
    let active = true;
    let unsubscribe = () => {};
    loadPlannerState()
      .then((loaded) => {
        if (!active) return;
        store.setState(() => loaded);
        unsubscribe = persistChanges(store);
        setHydrated(true);
      })
      // Stay un-hydrated on failure so the empty in-memory state never overwrites stored data.
      .catch((error) => reportError(error, { where: 'loadPlannerState' }));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [store, initialState]);

  const value = useMemo(() => ({ store, actions, hydrated }), [store, actions, hydrated]);
  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}
