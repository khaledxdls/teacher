import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { applyRemote, collectDirty, markAllDirty, markPushed } from '../domain/sync';
import { api, ApiError, AuthResponse } from '../services/api';
import { reportError } from '../services/errorReporting';
import { clearSession, loadSession, saveSession, Session } from '../services/session';
import { clearSyncCursor, loadSyncCursor, saveSyncCursor, SyncCursor } from '../services/storage';
import { usePendingChanges, usePlannerHydrated, usePlannerStore } from './planner';

export type SyncStatus = 'signedOut' | 'idle' | 'syncing' | 'error';
/** Why the session ended, so the UI can explain it (translated there). */
export type SessionEndReason = 'expired' | 'accountDeleted' | null;

type SyncContextValue = {
  ready: boolean;
  session: Session | null;
  status: SyncStatus;
  /** Last sync error; `isNetworkError` lets the UI show a friendly message. */
  error: ApiError | Error | null;
  endReason: SessionEndReason;
  lastSyncedAt: number | null;
  pendingChanges: number;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  /** Signs in with a session returned by a password change or reset. */
  adoptSession: (response: AuthResponse) => Promise<void>;
  signOut: (reason?: SessionEndReason) => Promise<void>;
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
  const store = usePlannerStore();
  const hydrated = usePlannerHydrated();
  const pendingChanges = usePendingChanges();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>('signedOut');
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [endReason, setEndReason] = useState<SessionEndReason>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const cursorRef = useRef<SyncCursor | null>(null);
  const hydratedRef = useRef(hydrated);
  const inFlight = useRef<Promise<void> | null>(null);
  const rerun = useRef(false);

  useEffect(() => { hydratedRef.current = hydrated; }, [hydrated]);

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
      .catch((loadError) => reportError(loadError, { where: 'loadSession' }))
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const signOut = useCallback(async (reason: SessionEndReason = null) => {
    sessionRef.current = null;
    cursorRef.current = null;
    setSession(null);
    setStatus('signedOut');
    setError(null);
    setEndReason(reason);
    setLastSyncedAt(null);
    await Promise.all([clearSession(), clearSyncCursor()]);
  }, []);

  const runSync = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || !hydratedRef.current) return;
    setStatus('syncing');
    setError(null);
    try {
      let cursor = cursorRef.current?.userId === current.user.id ? cursorRef.current.cursor : 0;
      for (const batch of chunk(collectDirty(store.getState()), BATCH_SIZE)) {
        const response = await api.sync(current.token, cursor, batch);
        // The session may have ended while the request was in flight.
        if (sessionRef.current?.token !== current.token) return;
        store.setState((state) => applyRemote(markPushed(state, batch), response.changes));
        cursor = response.cursor;
      }
      const saved: SyncCursor = { userId: current.user.id, cursor, lastSyncedAt: Date.now() };
      cursorRef.current = saved;
      await saveSyncCursor(saved);
      setLastSyncedAt(saved.lastSyncedAt);
      setStatus('idle');
    } catch (syncError) {
      if (syncError instanceof ApiError && syncError.status === 401) {
        await signOut('expired');
        return;
      }
      if (!(syncError instanceof ApiError)) reportError(syncError, { where: 'sync' });
      setStatus('error');
      setError(syncError instanceof Error ? syncError : new Error(String(syncError)));
    }
  }, [store, signOut]);

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

  const adoptSession = useCallback(async (next: AuthResponse) => {
    await saveSession(next);
    const switchingAccount = cursorRef.current?.userId !== next.user.id;
    if (switchingAccount) {
      cursorRef.current = null;
      await clearSyncCursor();
      // Upload everything on this device into the account; the server keeps whichever version is newer.
      store.setState(markAllDirty);
    }
    sessionRef.current = next;
    setSession(next);
    setStatus('idle');
    setError(null);
    setEndReason(null);
  }, [store]);

  const signIn = useCallback(async (email: string, password: string) => {
    await adoptSession(await api.login(email.trim(), password));
  }, [adoptSession]);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    await adoptSession(await api.register(email.trim(), password, name?.trim()));
  }, [adoptSession]);

  // Push unsynced changes shortly after edits settle.
  useEffect(() => {
    if (!hydrated || !session || !pendingChanges) return;
    const timeout = setTimeout(() => { void syncNow(); }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [hydrated, session, pendingChanges, syncNow]);

  // Sync on sign-in and launch, when the app returns to the foreground, and periodically while open.
  useEffect(() => {
    if (!ready || !hydrated || !session) return;
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
  }, [ready, hydrated, session, syncNow]);

  const value = useMemo<SyncContextValue>(() => ({
    ready, session, status, error, endReason, lastSyncedAt, pendingChanges, signIn, signUp, adoptSession, signOut, syncNow,
  }), [ready, session, status, error, endReason, lastSyncedAt, pendingChanges, signIn, signUp, adoptSession, signOut, syncNow]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
