import AsyncStorage from '@react-native-async-storage/async-storage';
import { LegacyClass, LegacyEntry, LegacyTemplate, migrateFromV1 } from '../domain/migrations';
import { PlannerState, SavedClass, ScheduleEntry, ScheduleTemplate } from '../domain/schedule';

/** v1 keys are only read for migration and are left untouched as a backup. */
const legacyKeys = {
  entries: 'teacher-schedule-v1',
  templates: 'teacher-schedule-templates-v1',
  classes: 'teacher-classes-v1',
} as const;

const keys = {
  schema: 'classpilot-schema',
  entries: 'classpilot-entries-v2',
  classes: 'classpilot-classes-v2',
  templates: 'classpilot-templates-v2',
  weeklyReminder: 'teacher-weekly-reminder-v1',
  sync: 'classpilot-sync-v2',
} as const;

const SCHEMA_VERSION = '2';

/** Parses a stored JSON array, falling back to `[]` if the value is missing or corrupted. */
function readArray<T>(key: string, raw: string | null): T[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) return value as T[];
  } catch {
    // fall through
  }
  console.warn(`Ignoring corrupted value stored under "${key}"`);
  return [];
}

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
  await savePlannerState(state);
  await AsyncStorage.setItem(keys.schema, SCHEMA_VERSION);
  return state;
}

export async function loadPlannerState(): Promise<PlannerState> {
  const schema = await AsyncStorage.getItem(keys.schema);
  if (schema !== SCHEMA_VERSION) return loadLegacyAndMigrate();
  const [entries, classes, templates] = await Promise.all([
    AsyncStorage.getItem(keys.entries),
    AsyncStorage.getItem(keys.classes),
    AsyncStorage.getItem(keys.templates),
  ]);
  return {
    entries: readArray<ScheduleEntry>(keys.entries, entries),
    classes: readArray<SavedClass>(keys.classes, classes),
    templates: readArray<ScheduleTemplate>(keys.templates, templates),
  };
}

export const saveEntries = (entries: ScheduleEntry[]) => AsyncStorage.setItem(keys.entries, JSON.stringify(entries));
export const saveClasses = (classes: SavedClass[]) => AsyncStorage.setItem(keys.classes, JSON.stringify(classes));
export const saveTemplates = (templates: ScheduleTemplate[]) => AsyncStorage.setItem(keys.templates, JSON.stringify(templates));

export const savePlannerState = (state: PlannerState) => Promise.all([
  saveEntries(state.entries), saveClasses(state.classes), saveTemplates(state.templates),
]);

export async function loadWeeklyReminder() {
  const value = await AsyncStorage.getItem(keys.weeklyReminder);
  return value === null ? true : value === 'true';
}
export const saveWeeklyReminder = (enabled: boolean) => AsyncStorage.setItem(keys.weeklyReminder, String(enabled));

/** Server cursor for incremental sync, tied to the account it belongs to. */
export type SyncCursor = { userId: string; cursor: number; lastSyncedAt: number | null };

export async function loadSyncCursor(): Promise<SyncCursor | null> {
  const raw = await AsyncStorage.getItem(keys.sync);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as SyncCursor;
    return typeof value?.userId === 'string' && typeof value.cursor === 'number' ? value : null;
  } catch {
    return null;
  }
}
export const saveSyncCursor = (cursor: SyncCursor) => AsyncStorage.setItem(keys.sync, JSON.stringify(cursor));
export const clearSyncCursor = () => AsyncStorage.removeItem(keys.sync);
