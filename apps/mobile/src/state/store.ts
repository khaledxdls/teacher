import { useSyncExternalStore } from 'react';

/**
 * A minimal external store. State lives outside React so actions always read the latest
 * value synchronously (no stale closures), and components subscribe to just the slices
 * they select.
 */
export type Store<T> = {
  getState: () => T;
  setState: (update: (state: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState(update) {
      const next = update(state);
      if (Object.is(next, state)) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Subscribes to `selector(state)`. Selectors must return stable references (e.g. a slice of state). */
export function useStoreSelector<T, S>(store: Store<T>, selector: (state: T) => S): S {
  const read = () => selector(store.getState());
  return useSyncExternalStore(store.subscribe, read, read);
}
