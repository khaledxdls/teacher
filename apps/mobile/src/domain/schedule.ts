/**
 * Every synced record carries sync metadata:
 * - `updatedAt`: client timestamp (ms) of the last change, used for last-write-wins merging.
 * - `deleted`: tombstone flag; deleted records are kept so the deletion can sync to other devices.
 * - `dirty`: local-only flag marking changes that have not been pushed to the server yet.
 */
export type SyncMeta = { updatedAt: number; deleted?: boolean; dirty?: boolean };

export type AttendanceStatus = 'present' | 'absent' | 'late';
export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent'];

export type ScheduleEntry = SyncMeta & {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  classId: string;
  room: string;
  notes?: string;
  /** Attendance by student id. Students without a value are unmarked. */
  attendance?: Record<string, AttendanceStatus>;
};

/** The editable part of an entry; sync metadata is added when it is saved. */
export type EntryDraft = Omit<ScheduleEntry, keyof SyncMeta>;

export type TemplateEntry = Pick<ScheduleEntry, 'startTime' | 'endTime' | 'subject' | 'classId' | 'room'> & { day: number };
export type ScheduleTemplate = SyncMeta & { id: string; name: string; entries: TemplateEntry[] };
export type Student = { id: string; name: string };
export type SavedClass = SyncMeta & { id: string; name: string; students: Student[] };

export type PlannerState = { entries: ScheduleEntry[]; classes: SavedClass[]; templates: ScheduleTemplate[] };
export const emptyPlannerState: PlannerState = { entries: [], classes: [], templates: [] };

const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_MINUTE_OF_DAY = 23 * 60 + 59;

export const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Marks a record as changed locally at `now`. */
export const touch = <T extends SyncMeta>(record: T, now: number): T => ({ ...record, updatedAt: now, dirty: true });
/** Replaces a record with a tombstone. */
export const tombstone = <T extends SyncMeta>(record: T, now: number): T => ({ ...touch(record, now), deleted: true });
export const alive = <T extends SyncMeta>(records: T[]) => records.filter((record) => !record.deleted);

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

export const sortEntries = <T extends Pick<ScheduleEntry, 'date' | 'startTime'>>(items: T[]) =>
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

export const findScheduleConflict = (candidate: Pick<ScheduleEntry, 'id' | 'date' | 'startTime' | 'endTime'>, entries: ScheduleEntry[]) =>
  entries.find((entry) => (
    entry.id !== candidate.id &&
    entry.date === candidate.date &&
    timeToMinutes(candidate.startTime) < timeToMinutes(entry.endTime) &&
    timeToMinutes(candidate.endTime) > timeToMinutes(entry.startTime)
  ));

/** Counts attendance for the given students; students without a mark are `unmarked`. */
export function attendanceSummary(entry: Pick<ScheduleEntry, 'attendance'>, students: Student[]) {
  const counts = { present: 0, late: 0, absent: 0, unmarked: 0 };
  for (const student of students) {
    const status = entry.attendance?.[student.id];
    counts[status ?? 'unmarked'] += 1;
  }
  return counts;
}

export type StudentAttendanceStats = { present: number; late: number; absent: number; marked: number };

/** Attendance totals per student id across all entries of a class. */
export function studentAttendanceStats(entries: ScheduleEntry[], classId: string) {
  const stats = new Map<string, StudentAttendanceStats>();
  for (const entry of entries) {
    if (entry.classId !== classId || !entry.attendance) continue;
    for (const [studentId, status] of Object.entries(entry.attendance)) {
      const current = stats.get(studentId) ?? { present: 0, late: 0, absent: 0, marked: 0 };
      current[status] += 1;
      current.marked += 1;
      stats.set(studentId, current);
    }
  }
  return stats;
}

/** Cycles unmarked → present → late → absent → unmarked. */
export function nextAttendanceStatus(current: AttendanceStatus | undefined): AttendanceStatus | undefined {
  if (!current) return ATTENDANCE_STATUSES[0];
  const index = ATTENDANCE_STATUSES.indexOf(current);
  return ATTENDANCE_STATUSES[index + 1];
}

export const createWeekTemplate = (name: string, weekEntries: ScheduleEntry[], start: Date, now: number): ScheduleTemplate => ({
  id: createId(),
  name,
  updatedAt: now,
  dirty: true,
  entries: weekEntries.map((entry) => ({
    day: daysBetween(start, parseDateKey(entry.date)),
    startTime: entry.startTime,
    endTime: entry.endTime,
    subject: entry.subject,
    classId: entry.classId,
    room: entry.room,
  })),
});

/**
 * Replaces every day the template covers in the given week with the template's classes.
 * Replaced entries become tombstones so the change syncs.
 */
export function applyTemplateToWeek(template: ScheduleTemplate, entries: ScheduleEntry[], start: Date, now: number): ScheduleEntry[] {
  const copied: ScheduleEntry[] = template.entries
    .filter((entry) => entry.day >= 0 && entry.day < 7)
    .map(({ day, ...entry }) => ({ ...entry, notes: '', date: dateKey(addDays(start, day)), id: createId(), updatedAt: now, dirty: true }));
  const coveredDays = new Set(copied.map((entry) => entry.date));
  return [
    ...entries.map((entry) => (!entry.deleted && coveredDays.has(entry.date) ? tombstone(entry, now) : entry)),
    ...copied,
  ];
}
