import { createContext, ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { applyRemote, collectDirty, markAllDirty, markPushed, SyncRecord } from '../domain/sync';
import { ApiError, login, register, syncChanges } from '../services/api';
import { clearSession, loadSession, saveSession, Session } from '../services/session';
import { clearSyncCursor, loadSyncCursor, saveSyncCursor, SyncCursor } from '../services/storage';
import { usePlanner } from './PlannerProvider';

export type SyncStatus = 'signedOut' | 'idle' | 'syncing' | 'error';

type SyncContextValue = {
  /** True once the stored session has been loaded. */
  ready: boolean;
  session: Session | null;
  status: SyncStatus;
  error: string | null;
  lastSyncedAt: number | null;
  pendingChanges: number;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync() {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside <SyncProvider>');
  return value;
}

/** Server limit is 500 changes per request. */
const BATCH_SIZE = 400;
/** Wait for edits to settle before pushing. */
const PUSH_DEBOUNCE_MS = 2_000;
/** Pull changes from other devices while the app is open. */
const POLL_INTERVAL_MS = 2 * 60 * 1000;

const chunk = <T,>(items: T[], size: number) =>
  items.length ? Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size)) : [[]];

/**
 * Keeps the planner in sync with the API for the signed-in teacher.
 * Local data always stays on the device; signing in merges it into the account.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const planner = usePlanner();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>('signedOut');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const plannerRef = useRef(planner);
  useLayoutEffect(() => { plannerRef.current = planner; }, [planner]);
  const sessionRef = useRef<Session | null>(null);
  const cursorRef = useRef<SyncCursor | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const rerun = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([loadSession(), loadSyncCursor()])
      .then(([storedSession, storedCursor]) => {
        if (!active) return;
        sessionRef.current = storedSession;
        cursorRef.current = storedCursor;
        setSession(storedSession);
        setLastSyncedAt(storedCursor?.userId === storedSession?.user.id ? storedCursor?.lastSyncedAt ?? null : null);
        setStatus(storedSession ? 'idle' : 'signedOut');
      })
      .catch((loadError) => console.warn('Failed to load session', loadError))
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const endSession = useCallback(async (message: string | null) => {
    sessionRef.current = null;
    cursorRef.current = null;
    setSession(null);
    setStatus('signedOut');
    setError(message);
    setLastSyncedAt(null);
    await Promise.all([clearSession(), clearSyncCursor()]);
  }, []);

  const runSync = useCallback(async () => {
    const current = sessionRef.current;
    const plannerNow = plannerRef.current;
    if (!current || !plannerNow.hydrated) return;
    setStatus('syncing');
    setError(null);
    try {
      let cursor = cursorRef.current?.userId === current.user.id ? cursorRef.current.cursor : 0;
      for (const batch of chunk(collectDirty(plannerRef.current.getState()), BATCH_SIZE)) {
        const response = await syncChanges(current.token, cursor, batch);
        // The session may have ended while the request was in flight.
        if (sessionRef.current?.token !== current.token) return;
        plannerRef.current.updateState((state) => applyRemote(markPushed(state, batch), response.changes as SyncRecord[]));
        cursor = response.cursor;
      }
      const saved: SyncCursor = { userId: current.user.id, cursor, lastSyncedAt: Date.now() };
      cursorRef.current = saved;
      await saveSyncCursor(saved);
      setLastSyncedAt(saved.lastSyncedAt);
      setStatus('idle');
    } catch (syncError) {
      if (syncError instanceof ApiError && syncError.status === 401) {
        await endSession('Your session expired. Sign in again to keep syncing.');
        return;
      }
      setStatus('error');
      setError(syncError instanceof Error ? syncError.message : 'Sync failed.');
    }
  }, [endSession]);

  /** Runs one sync at a time; a request made during a sync triggers one more run afterwards. */
  const syncNow = useCallback(async () => {
    if (inFlight.current) {
      rerun.current = true;
      return inFlight.current;
    }
    const loop = async () => {
      do {
        rerun.current = false;
        await runSync();
      } while (rerun.current);
    };
    inFlight.current = loop().finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, [runSync]);

  const startSession = useCallback(async (next: Session) => {
    await saveSession(next);
    if (cursorRef.current?.userId !== next.user.id) {
      cursorRef.current = null;
      await clearSyncCursor();
    }
    sessionRef.current = next;
    setSession(next);
    setStatus('idle');
    setError(null);
    // Upload everything on this device into the account; the server keeps whichever version is newer.
    // The session effect below starts the first sync after this update has rendered.
    plannerRef.current.updateState(markAllDirty);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await startSession(await login(email.trim(), password));
  }, [startSession]);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    await startSession(await register(email.trim(), password, name?.trim()));
  }, [startSession]);

  const signOut = useCallback(() => endSession(null), [endSession]);

  const { pendingChanges } = planner;

  // Push unsynced changes shortly after edits settle.
  useEffect(() => {
    if (!planner.hydrated || !session || !pendingChanges) return;
    const timeout = setTimeout(() => { void syncNow(); }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [planner.hydrated, planner.entries, planner.classes, planner.templates, pendingChanges, session, syncNow]);

  // Sync on launch, when the app returns to the foreground, and periodically while it is open.
  useEffect(() => {
    if (!ready || !planner.hydrated || !session) return;
    void syncNow();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void syncNow();
    }, POLL_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [ready, planner.hydrated, session, syncNow]);

  const value = useMemo<SyncContextValue>(() => ({
    ready, session, status, error, lastSyncedAt, pendingChanges, signIn, signUp, signOut, syncNow,
  }), [ready, session, status, error, lastSyncedAt, pendingChanges, signIn, signUp, signOut, syncNow]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
