import { DateKey, TimeOfDay } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_MINUTE_OF_DAY = 23 * 60 + 59;

export const pad = (value: number) => String(value).padStart(2, '0');
export const dateKey = (date: Date): DateKey => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const monthKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
export const todayKey = () => dateKey(new Date());

/** Parses a `YYYY-MM-DD` key as local midnight. */
export const parseDateKey = (key: DateKey) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseDateKey(value)) === value;

export const addDays = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};
export const addDaysToKey = (key: DateKey, amount: number) => dateKey(addDays(parseDateKey(key), amount));

/** Adds months while clamping the day, so Jan 31 + 1 month is Feb 28/29 rather than early March. */
export const addMonths = (date: Date, amount: number) => {
  const result = new Date(date.getFullYear(), date.getMonth() + amount, 1, date.getHours(), date.getMinutes());
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDay));
  return result;
};

export const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
export const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

/** Whole calendar days from `from` to `to`, safe across DST changes. */
export const daysBetween = (from: Date, to: Date) => {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
};

/** Inclusive range check on date keys (lexicographic order matches date order). */
export const inDateRange = (key: DateKey, from: DateKey, to: DateKey) => key >= from && key <= to;

// The teaching week runs Friday through Thursday.
export const weekStart = (date: Date) => {
  const result = new Date(date);
  const daysSinceFriday = (result.getDay() + 2) % 7;
  result.setDate(result.getDate() - daysSinceFriday);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const weekDays = (start: Date) => Array.from({ length: 7 }, (_, index) => addDays(start, index));

export const timeToMinutes = (time: TimeOfDay) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};
export const minutesToTime = (minutes: number): TimeOfDay => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
export const formatTime = (date: Date): TimeOfDay => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const timeToDate = (time: TimeOfDay) => {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hours, minutes);
};

/** The moment a lesson on `date` at `time` happens, in local time. */
export const dateTimeOf = (date: DateKey, time: TimeOfDay) => {
  const result = parseDateKey(date);
  result.setMinutes(timeToMinutes(time));
  return result;
};

/** One hour after `startTime`, capped at 23:59 so the class never wraps past midnight. */
export const defaultEndTime = (startTime: TimeOfDay) =>
  minutesToTime(Math.min(timeToMinutes(startTime) + 60, LAST_MINUTE_OF_DAY));
