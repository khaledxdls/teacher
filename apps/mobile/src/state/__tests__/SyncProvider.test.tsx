import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { PlannerState } from '../../domain/schedule';
import { SyncRecord } from '../../domain/sync';
import * as api from '../../services/api';
import * as session from '../../services/session';
import * as storage from '../../services/storage';
import { PlannerProvider, usePlanner } from '../PlannerProvider';
import { SyncProvider, useSync } from '../SyncProvider';

jest.mock('../../services/storage', () => ({
  loadPlannerState: jest.fn(),
  loadWeeklyReminder: jest.fn(async () => true),
  saveEntries: jest.fn(async () => undefined),
  saveTemplates: jest.fn(async () => undefined),
  saveClasses: jest.fn(async () => undefined),
  saveWeeklyReminder: jest.fn(async () => undefined),
  loadSyncCursor: jest.fn(async () => null),
  saveSyncCursor: jest.fn(async () => undefined),
  clearSyncCursor: jest.fn(async () => undefined),
}));

jest.mock('../../services/notifications', () => ({
  requestNotificationPermission: jest.fn(async () => undefined),
  scheduleClassReminders: jest.fn(async () => undefined),
  scheduleWeeklyReminder: jest.fn(async () => undefined),
}));

jest.mock('../../services/session', () => ({
  loadSession: jest.fn(async () => null),
  saveSession: jest.fn(async () => undefined),
  clearSession: jest.fn(async () => undefined),
}));

jest.mock('../../services/api', () => {
  const actual = jest.requireActual('../../services/api');
  return { ...actual, login: jest.fn(), register: jest.fn(), syncChanges: jest.fn() };
});

const store = jest.mocked(storage);
const sessions = jest.mocked(session);
const server = jest.mocked(api);

const USER = { id: 'u1', email: 'teacher@example.com', name: null };
const SESSION = { token: 'token-1', user: USER };

const wrapper = ({ children }: { children: ReactNode }) => (
  <PlannerProvider><SyncProvider>{children}</SyncProvider></PlannerProvider>
);

const localState = (overrides: Partial<PlannerState> = {}): PlannerState => ({
  entries: [], templates: [],
  classes: [{ id: 'k1', name: '7B', students: [], updatedAt: 10 }],
  ...overrides,
});

async function renderSync(state: PlannerState = localState()) {
  store.loadPlannerState.mockResolvedValue(state);
  const hook = await renderHook(() => ({ sync: useSync(), planner: usePlanner() }), { wrapper });
  await waitFor(() => expect(hook.result.current.sync.ready && hook.result.current.planner.hydrated).toBe(true));
  return hook;
}

describe('SyncProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    server.syncChanges.mockImplementation(async (_token, cursor) => ({ cursor, changes: [] }));
  });

  it('stays signed out and never calls the server without a session', async () => {
    const { result } = await renderSync();
    expect(result.current.sync.status).toBe('signedOut');
    expect(server.syncChanges).not.toHaveBeenCalled();
  });

  it('uploads local data after signing in and stores the cursor', async () => {
    server.login.mockResolvedValue(SESSION);
    server.syncChanges.mockImplementation(async (_token, _cursor, changes) => ({ cursor: 1, changes }));
    const { result } = await renderSync();

    await act(async () => { await result.current.sync.signIn(' teacher@example.com ', 'password123'); });

    expect(server.login).toHaveBeenCalledWith('teacher@example.com', 'password123');
    expect(sessions.saveSession).toHaveBeenCalledWith(SESSION);
    await waitFor(() => expect(result.current.sync.lastSyncedAt).not.toBeNull());
    const [token, cursor, changes] = server.syncChanges.mock.calls[0];
    expect([token, cursor]).toEqual(['token-1', 0]);
    expect(changes).toEqual([expect.objectContaining({ collection: 'class', id: 'k1', updatedAt: 10 })]);
    expect(store.saveSyncCursor).toHaveBeenLastCalledWith({ userId: 'u1', cursor: 1, lastSyncedAt: expect.any(Number) });
    expect(result.current.planner.getState().classes[0].dirty).toBe(false);
    expect(result.current.sync.status).toBe('idle');
  });

  it('merges changes from other devices into the planner', async () => {
    sessions.loadSession.mockResolvedValueOnce(SESSION);
    store.loadSyncCursor.mockResolvedValueOnce({ userId: 'u1', cursor: 3, lastSyncedAt: 1 });
    const remote: SyncRecord = { collection: 'class', id: 'k2', updatedAt: 20, deleted: false, data: { id: 'k2', name: '9C', students: [] } };
    server.syncChanges.mockResolvedValueOnce({ cursor: 4, changes: [remote] });

    const { result } = await renderSync();
    await waitFor(() => expect(result.current.planner.classes.map((item) => item.name)).toEqual(['7B', '9C']));
    expect(server.syncChanges).toHaveBeenCalledWith('token-1', 3, []);
  });

  it('pushes local edits shortly after they are made', async () => {
    sessions.loadSession.mockResolvedValueOnce(SESSION);
    store.loadSyncCursor.mockResolvedValueOnce({ userId: 'u1', cursor: 1, lastSyncedAt: 1 });
    const { result } = await renderSync();
    await waitFor(() => expect(server.syncChanges).toHaveBeenCalledTimes(1));

    await act(async () => { result.current.planner.addClass('8A'); });
    expect(result.current.sync.pendingChanges).toBe(1);
    await waitFor(() => expect(server.syncChanges).toHaveBeenCalledTimes(2), { timeout: 4000 });
    expect(server.syncChanges.mock.calls[1][2]).toEqual([expect.objectContaining({ collection: 'class', data: expect.objectContaining({ name: '8A' }) })]);
    await waitFor(() => expect(result.current.sync.pendingChanges).toBe(0));
  });

  it('signs out and keeps local data when the token has expired', async () => {
    sessions.loadSession.mockResolvedValueOnce(SESSION);
    server.syncChanges.mockRejectedValueOnce(new api.ApiError(401, 'Sign in again to continue.'));
    const { result } = await renderSync();

    await waitFor(() => expect(result.current.sync.status).toBe('signedOut'));
    expect(result.current.sync.error).toMatch(/session expired/);
    expect(sessions.clearSession).toHaveBeenCalled();
    expect(result.current.planner.classes).toHaveLength(1);
  });

  it('reports network errors and keeps changes pending', async () => {
    sessions.loadSession.mockResolvedValueOnce(SESSION);
    server.syncChanges.mockRejectedValueOnce(new api.ApiError(0, "Can't reach the server."));
    const { result } = await renderSync(localState({ classes: [{ id: 'k1', name: '7B', students: [], updatedAt: 10, dirty: true }] }));

    await waitFor(() => expect(result.current.sync.status).toBe('error'));
    expect(result.current.sync.error).toBe("Can't reach the server.");
    expect(result.current.planner.getState().classes[0].dirty).toBe(true);
  });

  it('starts from cursor 0 when a different account signs in', async () => {
    store.loadSyncCursor.mockResolvedValueOnce({ userId: 'someone-else', cursor: 9, lastSyncedAt: 1 });
    server.register.mockResolvedValue(SESSION);
    const { result } = await renderSync();

    await act(async () => { await result.current.sync.signUp('teacher@example.com', 'password123', 'Ms T'); });
    await waitFor(() => expect(server.syncChanges).toHaveBeenCalled());
    expect(server.register).toHaveBeenCalledWith('teacher@example.com', 'password123', 'Ms T');
    expect(store.clearSyncCursor).toHaveBeenCalled();
    expect(server.syncChanges.mock.calls[0][1]).toBe(0);
  });
});
