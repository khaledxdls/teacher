import { createStore } from '../store';

describe('createStore', () => {
  it('notifies subscribers on change and skips no-op updates', () => {
    const store = createStore({ count: 0 });
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    store.setState((state) => ({ count: state.count + 1 }));
    store.setState((state) => state);
    expect(store.getState()).toEqual({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.setState(() => ({ count: 2 }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
