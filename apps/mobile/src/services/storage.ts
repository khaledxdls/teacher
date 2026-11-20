import AsyncStorage from '@react-native-async-storage/async-storage';
import { LegacyClass, LegacyEntry, LegacyTemplate, migrateFromV1, normalizeState } from '../domain/migrations';
import { PlannerState } from '../domain/types';

/** v1 keys are only read for migration and are left untouched as a backup. */
const legacyKeys = {
  entries: 'teacher-schedule-v1',
  templates: 'teacher-schedule-templates-v1',
  classes: 'teacher-classes-v1',
  weeklyReminder: 'teacher-weekly-reminder-v1',
} as const;

const SCHEMA_KEY = 'classpilot-schema';
const SCHEMA_VERSION = '2';

/** One AsyncStorage key per collection keeps each write small. */
const collectionKeys: Record<keyof PlannerState, string> = {
  entries: 'classpilot-entries-v2',
  classes: 'classpilot-classes-v2',
  templates: 'classpilot-templates-v2',
  assessments: 'classpilot-assessments-v2',
  events: 'classpilot-events-v2',
  settings: 'classpilot-settings-v2',
};
const collectionNames = Object.keys(collectionKeys) as (keyof PlannerState)[];

const keys = {
  preferences: 'classpilot-preferences',
  sync: 'classpilot-sync-v2',
} as const;

function parseJson<T>(key: string, raw: string | null, isValid: (value: unknown) => boolean, fallback: T): T {
  if (!raw) return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    if (isValid(value)) return value as T;
  } catch {
    // fall through
  }
  console.warn(`Ignoring corrupted value stored under "${key}"`);
  return fallback;
}

const readArray = <T>(key: string, raw: string | null) => parseJson<T[]>(key, raw, Array.isArray, []);

async function loadLegacyAndMigrate(): Promise<PlannerState> {
  const [entries, templates, classes] = await Promise.all([
    AsyncStorage.getItem(legacyKeys.entries),
    AsyncStorage.getItem(legacyKeys.templates),
    AsyncStorage.getItem(legacyKeys.classes),
  ]);
  const state = migrateFromV1({
    entries: readArray<LegacyEntry>(legacyKeys.entries, entries),
    templates: readArray<LegacyTemplate>(legacyKeys.templates, templates),
    classes: readArray<LegacyClass>(legacyKeys.classes, classes),
  }, Date.now());
  await Promise.all(collectionNames.map((name) => saveCollection(name, state[name])));
  await AsyncStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
  return state;
}

export async function loadPlannerState(): Promise<PlannerState> {
  if ((await AsyncStorage.getItem(SCHEMA_KEY)) !== SCHEMA_VERSION) return loadLegacyAndMigrate();
  const values = await Promise.all(collectionNames.map((name) => AsyncStorage.getItem(collectionKeys[name])));
  return normalizeState(Object.fromEntries(collectionNames.map((name, index) => [name, readArray(collectionKeys[name], values[index])])));
}

export const saveCollection = <K extends keyof PlannerState>(name: K, records: PlannerState[K]) =>
  AsyncStorage.setItem(collectionKeys[name], JSON.stringify(records));

/** Device-local settings; never synced. */
export type ThemePreference = 'system' | 'light' | 'dark';
export type LanguagePreference = 'system' | 'en' | 'fr' | 'ar';
export type Preferences = { weeklyReminder: boolean; theme: ThemePreference; language: LanguagePreference };
export const defaultPreferences: Preferences = { weeklyReminder: true, theme: 'system', language: 'system' };

export async function loadPreferences(): Promise<Preferences> {
  const [raw, legacyReminder] = await Promise.all([
    AsyncStorage.getItem(keys.preferences),
    AsyncStorage.getItem(legacyKeys.weeklyReminder),
  ]);
  const stored = parseJson<Partial<Preferences>>(keys.preferences, raw, (value) => typeof value === 'object' && value !== null, {});
  // Before preferences existed, only the weekly reminder flag was stored.
  const weeklyReminder = stored.weeklyReminder ?? (legacyReminder === null ? true : legacyReminder === 'true');
  return { ...defaultPreferences, ...stored, weeklyReminder };
}

export const savePreferences = (preferences: Preferences) => AsyncStorage.setItem(keys.preferences, JSON.stringify(preferences));

/** Server cursor for incremental sync, tied to the account it belongs to. */
export type SyncCursor = { userId: string; cursor: number; lastSyncedAt: number | null };

export async function loadSyncCursor(): Promise<SyncCursor | null> {
  const isCursor = (value: unknown) => {
    const cursor = value as SyncCursor;
    return typeof cursor?.userId === 'string' && typeof cursor.cursor === 'number';
  };
  return parseJson<SyncCursor | null>(keys.sync, await AsyncStorage.getItem(keys.sync), isCursor, null);
}
export const saveSyncCursor = (cursor: SyncCursor) => AsyncStorage.setItem(keys.sync, JSON.stringify(cursor));
export const clearSyncCursor = () => AsyncStorage.removeItem(keys.sync);
