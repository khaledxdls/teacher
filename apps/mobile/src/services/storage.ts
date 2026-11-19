import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedClass, ScheduleEntry, ScheduleTemplate } from '../domain/schedule';

const keys = {
  entries: 'teacher-schedule-v1',
  templates: 'teacher-schedule-templates-v1',
  weeklyReminder: 'teacher-weekly-reminder-v1',
  classes: 'teacher-classes-v1',
} as const;

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

export async function loadSchedule() {
  const [entries, templates, weeklyReminder, classes] = await Promise.all([
    AsyncStorage.getItem(keys.entries),
    AsyncStorage.getItem(keys.templates),
    AsyncStorage.getItem(keys.weeklyReminder),
    AsyncStorage.getItem(keys.classes),
  ]);
  return {
    entries: readArray<ScheduleEntry>(keys.entries, entries),
    templates: readArray<ScheduleTemplate>(keys.templates, templates),
    weeklyReminder: weeklyReminder === null ? true : weeklyReminder === 'true',
    classes: readArray<SavedClass>(keys.classes, classes),
  };
}

export const saveEntries = (entries: ScheduleEntry[]) => AsyncStorage.setItem(keys.entries, JSON.stringify(entries));
export const saveTemplates = (templates: ScheduleTemplate[]) => AsyncStorage.setItem(keys.templates, JSON.stringify(templates));
export const saveWeeklyReminder = (enabled: boolean) => AsyncStorage.setItem(keys.weeklyReminder, String(enabled));
export const saveClasses = (classes: SavedClass[]) => AsyncStorage.setItem(keys.classes, JSON.stringify(classes));
