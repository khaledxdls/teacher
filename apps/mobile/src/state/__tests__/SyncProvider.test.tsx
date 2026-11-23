import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { SyncRecord } from '../../domain/sync';
import { emptyPlannerState, PlannerState } from '../../domain/types';
import { api, ApiError } from '../../services/api';
import * as session from '../../services/session';
import * as storage from '../../services/storage';
import { classOf } from '../../test-utils/domainFixtures';
import { createMemoryRepository } from '../../test-utils/memoryRepository';
import { useClasses, usePlannerActions, usePlannerStore } from '../planner';
import { PlannerProvider } from '../PlannerProvider';
import { SyncProvider, useSync } from '../SyncProvider';

jest.mock('../../services/storage', () => ({
  loadSyncCursor: jest.fn(async () => null),
  saveSyncCursor: jest.fn(async () => undefined),
  clearSyncCursor: jest.fn(async () => undefined),
}));
jest.mock('../../services/session', () => ({
  loadSession: jest.fn(async () => null),
  saveSession: jest.fn(async () => undefined),
  clearSession: jest.fn(async () => undefined),
}));
jest.mock('../../services/errorReporting', () => ({ reportError: jest.fn() }));
jest.mock('../../services/api', () => {
  const actual = jest.requireActual('../../services/api');
  return { ...actual, api: { login: jest.fn(), register: jest.fn(), sync: jest.fn() } };
});

const stored = jest.mocked(storage);
const sessions = jest.mocked(session);
const server = jest.mocked(api);

const USER = { id: 'u1', email: 'teacher@example.com', name: null };
const SESSION = { token: 'token-1', user: USER };

async function renderSync(state: PlannerState = { ...emptyPlannerState, classes: [classOf('k1', '7B', { updatedAt: 10 })] }) {
  const repository = createMemoryRepository(state);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PlannerProvider initialState={state} repository={repository}><SyncProvider>{children}</SyncProvider></PlannerProvider>
  );
  const hook = await renderHook(() => ({ sync: useSync(), classes: useClasses(), actions: usePlannerActions(), store: usePlannerStore() }), { wrapper });
  await waitFor(() => expect(hook.result.current.sync.ready).toBe(true));
  return hook;
}

describe('SyncProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    server.sync.mockImplementation(async (_token, cursor) => ({ cursor, changes: [] }));
  });

  it('stays signed out and never calls the server without a session', async () => {
    const { result } = await renderSync();
    expect(result.current.sync.status).toBe('signedOut');
    expect(server.sync).not.toHaveBeenCalled();
  });

  it('uploads local data after signing in and stores the cursor', async () => {
    server.login.mockResolvedValue(SESSION);
    server.sync.mockImplementation(async (_token, _cursor, changes) => ({ cursor: 1, changes }));
    const { result } = await renderSync();

    await act(async () => { await result.current.sync.signIn(' teacher@example.com ', 'password123'); });

    expect(server.login).toHaveBeenCalledWith('teacher@example.com', 'password123');
    expect(sessions.saveSession).toHaveBeenCalledWith(SESSION);
    await waitFor(() => expect(result.current.sync.lastSyncedAt).not.toBeNull());
    expect(server.sync.mock.calls[0].slice(0, 2)).toEqual(['token-1', 0]);
    expect(server.sync.mock.calls[0][2]).toEqual([expect.objectContaining({ collection: 'class', id: 'k1', updatedAt: 10 })]);
    expect(stored.saveSyncCursor).toHaveBeenLastCalledWith({ userId: 'u1', cursor: 1, lastSyncedAt: expect.any(Number) });
    expect(result.current.store.getState().classes[0].dirty).toBe(false);
    expect(result.current.sync.status).toBe('idle');
  });

  it('merges changes from other devices', async () => {
    sessions.loadSession.mockResolvedValueOnce(SESSION);
    stored.loadSyncCursor.mockResolvedValueOnce({ userId: 'u1', cursor: 3, lastSyncedAt: 1 });
    const remote: SyncRecord = { collection: 'class', id: 'k2', updatedAt: 20, deleted: false, data: { id: 'k2', name: '9C' } };
    server.sync.mockResolvedValueOnce({ cursor: 4, changes: [remote] });

    const { result } = await renderSync();
    await waitFor(() => expect(result.current.classes.map((item) => item.name)).toEqual(['7B', '9C']));
    expect(server.sync).toHaveBeenCalledWith('token-1', 3, []);
  });

  it('upgrades records sent in the older embedded shape by another device', async () => {
    sessions.loadSession.mockResolvedValueOnce(SESSION);
    const legacy: SyncRecord = { collection: 'class', id: 'k3', updatedAt: 30, deleted: false, data: { id: 'k3', name: '10A', students: [{ id: 'zoe', name: 'Zoe' }] } };
    server.sync.mockResolvedValueOnce({ cursor: 1, changes: [legacy] });

    const { result } = await renderSync();
    await waitFor(() => expect(result.current.store.getState().students.map((item) => item.name)).toEqual(['Zoe']));
    expect(result.current.store.getState().classes.find((item) => item.id === 'k3')).not.toHaveProperty('students');
  });

  it('pushes local edits shortly after they are made', async () => {
    sessions.loadSession.mockResolvedValueOnce(SESSION);
    stored.loadSyncCursor.mockResolvedValueOnce({ userId: 'u1', cursor: 1, lastSyncedAt: 1 });
    const { result } = await renderSync();
    await waitFor(() => expect(server.sync).toHaveBeenCalledTimes(1));

    await act(async () => { result.current.actions.addClass({ name: '8A' }); });
    expect(result.current.sync.pendingChanges).toBe(1);
    await waitFor(() => expect(server.sync).toHaveBeenCalledTimes(2), { timeout: 4000 });
    expect(server.sync.mock.calls[1][2]).toEqual([expect.objectContaining({ data: expect.objectContaining({ name: '8A' }) })]);
    await waitFor(() => expect(result.current.sync.pendingChanges).toBe(0));
  });

  it('signs out and keeps local data when the token has expired', async () => {
    sessions.loadSession.mockResolvedValueOnce(SESSION);
    server.sync.mockRejectedValueOnce(new ApiError(401, 'Sign in again to continue.'));
    const { result } = await renderSync();

    await waitFor(() => expect(result.current.sync.status).toBe('signedOut'));
    expect(result.current.sync.endReason).toBe('expired');
    expect(sessions.clearSession).toHaveBeenCalled();
    expect(result.current.classes).toHaveLength(1);
  });

  it('reports network errors and keeps changes pending', async () => {
    sessions.loadSession.mockResolvedValueOnce(SESSION);
    server.sync.mockRejectedValueOnce(new ApiError(0, "Can't reach the server."));
    const { result } = await renderSync({ ...emptyPlannerState, classes: [classOf('k1', '7B', { dirty: true })] });

    await waitFor(() => expect(result.current.sync.status).toBe('error'));
    expect((result.current.sync.error as ApiError).isNetworkError).toBe(true);
    expect(result.current.store.getState().classes[0].dirty).toBe(true);
  });

  it('uploads everything when a different account signs in, but not when the same account re-authenticates', async () => {
    stored.loadSyncCursor.mockResolvedValueOnce({ userId: 'someone-else', cursor: 9, lastSyncedAt: 1 });
    server.register.mockResolvedValue(SESSION);
    const { result } = await renderSync();

    await act(async () => { await result.current.sync.signUp('teacher@example.com', 'password123', 'Ms T'); });
    await waitFor(() => expect(server.sync).toHaveBeenCalled());
    expect(stored.clearSyncCursor).toHaveBeenCalled();
    expect(server.sync.mock.calls[0][1]).toBe(0);
    await waitFor(() => expect(result.current.sync.status).toBe('idle'));

    // A password change returns a new session for the same user: no re-upload.
    await act(async () => { await result.current.sync.adoptSession({ token: 'token-2', user: USER }); });
    expect(result.current.store.getState().classes.every((item) => !item.dirty)).toBe(true);
  });
});
