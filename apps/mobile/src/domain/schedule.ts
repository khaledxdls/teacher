import { addDays, dateKey, dateTimeOf, monthKey, timeToMinutes } from './dates';
import { DateKey, ScheduleEntry } from './types';

type Timed = Pick<ScheduleEntry, 'date' | 'startTime'>;

export const sortEntries = <T extends Timed>(items: T[]) =>
  [...items].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

export const entriesOn = (entries: ScheduleEntry[], date: DateKey) =>
  sortEntries(entries.filter((entry) => entry.date === date));

export const entriesInWeek = (entries: ScheduleEntry[], start: Date) => {
  const from = dateKey(start);
  const to = dateKey(addDays(start, 7));
  return sortEntries(entries.filter((entry) => entry.date >= from && entry.date < to));
};

export const entriesInMonth = (entries: ScheduleEntry[], date: Date) =>
  sortEntries(entries.filter((entry) => entry.date.startsWith(monthKey(date))));

export const findScheduleConflict = (
  candidate: Pick<ScheduleEntry, 'id' | 'date' | 'startTime' | 'endTime'>,
  entries: ScheduleEntry[],
  ignoreIds: ReadonlySet<string> = new Set(),
) => entries.find((entry) => (
  entry.id !== candidate.id &&
  !ignoreIds.has(entry.id) &&
  entry.date === candidate.date &&
  timeToMinutes(candidate.startTime) < timeToMinutes(entry.endTime) &&
  timeToMinutes(candidate.endTime) > timeToMinutes(entry.startTime)
));

/** The lesson happening now, if any. */
export const currentEntry = (entries: ScheduleEntry[], now: Date) =>
  entries.find((entry) => dateTimeOf(entry.date, entry.startTime) <= now && now < dateTimeOf(entry.date, entry.endTime));

/** The next lesson that has not started yet. */
export const nextEntry = (entries: ScheduleEntry[], now: Date) =>
  sortEntries(entries).find((entry) => dateTimeOf(entry.date, entry.startTime) > now);
