export type ScheduleEntry = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  className: string;
  room: string;
  notes?: string;
};

export type TemplateEntry = Omit<ScheduleEntry, 'id' | 'date' | 'notes'> & { day: number };
/** `version: 2` marks templates whose `day` is 0-based (Friday = 0). Older templates were saved shifted by +1. */
export type ScheduleTemplate = { id: string; name: string; entries: TemplateEntry[]; version?: 2 };
export type Student = { id: string; name: string };
export type SavedClass = { id: string; name: string; students: Student[] };

const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_MINUTE_OF_DAY = 23 * 60 + 59;

export const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const pad = (value: number) => String(value).padStart(2, '0');
export const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const monthKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

/** Parses a `YYYY-MM-DD` key as local midnight. */
export const parseDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};

/** Adds months while clamping the day, so Jan 31 + 1 month is Feb 28/29 rather than early March. */
export const addMonths = (date: Date, amount: number) => {
  const result = new Date(date.getFullYear(), date.getMonth() + amount, 1, date.getHours(), date.getMinutes());
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDay));
  return result;
};

/** Whole calendar days from `from` to `to`, safe across DST changes. */
export const daysBetween = (from: Date, to: Date) => {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
};

// The teaching week runs Friday through Thursday.
export const weekStart = (date: Date) => {
  const result = new Date(date);
  const daysSinceFriday = (result.getDay() + 2) % 7;
  result.setDate(result.getDate() - daysSinceFriday);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const weekDays = (start: Date) => Array.from({ length: 7 }, (_, index) => addDays(start, index));

export const displayDate = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export const sortEntries = (items: ScheduleEntry[]) =>
  [...items].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

export const entriesInWeek = (entries: ScheduleEntry[], start: Date) => {
  const from = dateKey(start);
  const to = dateKey(addDays(start, 7));
  return sortEntries(entries.filter((entry) => entry.date >= from && entry.date < to));
};

export const entriesInMonth = (entries: ScheduleEntry[], date: Date) =>
  sortEntries(entries.filter((entry) => entry.date.startsWith(monthKey(date))));

export const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const minutesToTime = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
export const formatTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const timeToDate = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hours, minutes);
};

/** One hour after `startTime`, capped at 23:59 so the class never wraps past midnight. */
export const defaultEndTime = (startTime: string) =>
  minutesToTime(Math.min(timeToMinutes(startTime) + 60, LAST_MINUTE_OF_DAY));

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const findScheduleConflict = (candidate: ScheduleEntry, entries: ScheduleEntry[]) =>
  entries.find((entry) => (
    entry.id !== candidate.id &&
    entry.date === candidate.date &&
    timeToMinutes(candidate.startTime) < timeToMinutes(entry.endTime) &&
    timeToMinutes(candidate.endTime) > timeToMinutes(entry.startTime)
  ));

/**
 * Normalizes saved classes: drops duplicate names (keeping the first) and adds a class
 * for every class name used by an entry that is not saved yet.
 */
export function mergeClasses(saved: SavedClass[], entries: ScheduleEntry[]): SavedClass[] {
  const result: SavedClass[] = [];
  const usedIds = new Set<string>();
  for (const item of saved) {
    if (!item?.name?.trim() || result.some((existing) => sameName(existing.name, item.name))) continue;
    const id = item.id && !usedIds.has(item.id) ? item.id : createId();
    usedIds.add(id);
    result.push({ id, name: item.name.trim(), students: Array.isArray(item.students) ? item.students : [] });
  }
  for (const entry of entries) {
    const name = entry.className.trim();
    if (!name || result.some((existing) => sameName(existing.name, name))) continue;
    result.push({ id: createId(), name, students: [] });
  }
  return result;
}

/** Converts templates saved before the off-by-one fix to 0-based day indexes. */
export const migrateTemplate = (template: ScheduleTemplate): ScheduleTemplate =>
  template.version === 2
    ? template
    : { ...template, version: 2, entries: template.entries.map((entry) => ({ ...entry, day: Math.max(0, entry.day - 1) })) };

export const createWeekTemplate = (name: string, weekEntries: ScheduleEntry[], start: Date): ScheduleTemplate => ({
  id: createId(),
  name,
  version: 2,
  entries: weekEntries.map(({ id: _id, date, notes: _notes, ...entry }) => ({ ...entry, day: daysBetween(start, parseDateKey(date)) })),
});

/** Replaces every day the template covers in the given week with the template's classes. */
export function applyTemplateToWeek(template: ScheduleTemplate, entries: ScheduleEntry[], start: Date): ScheduleEntry[] {
  const copied = template.entries
    .filter((entry) => entry.day >= 0 && entry.day < 7)
    .map(({ day, ...entry }) => ({ ...entry, notes: '', date: dateKey(addDays(start, day)), id: createId() }));
  const coveredDays = new Set(copied.map((entry) => entry.date));
  return [...entries.filter((entry) => !coveredDays.has(entry.date)), ...copied];
}
