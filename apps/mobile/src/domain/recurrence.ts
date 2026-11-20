import { addDaysToKey } from './dates';
import { DateKey, ScheduleEntry } from './types';

export type RepeatFrequency = 'none' | 'weekly' | 'biweekly';
export type Recurrence = { frequency: RepeatFrequency; until: DateKey };

/** Which lessons of a repeating series an edit or deletion applies to. */
export type SeriesScope = 'single' | 'following';

/** Guards against runaway series (about a school year of weekly lessons). */
export const MAX_OCCURRENCES = 60;

const INTERVAL_DAYS: Record<Exclude<RepeatFrequency, 'none'>, number> = { weekly: 7, biweekly: 14 };

/**
 * Dates of every lesson in a series starting on `start`. The first lesson is always
 * included (the teacher picked that day); later ones skip non-school days.
 */
export function occurrenceDates(start: DateKey, recurrence: Recurrence, isSchoolDay: (date: DateKey) => boolean): DateKey[] {
  if (recurrence.frequency === 'none') return [start];
  const step = INTERVAL_DAYS[recurrence.frequency];
  const dates = [start];
  for (let date = addDaysToKey(start, step); date <= recurrence.until && dates.length < MAX_OCCURRENCES; date = addDaysToKey(date, step)) {
    if (isSchoolDay(date)) dates.push(date);
  }
  return dates;
}

/** The lessons an edit with `scope` applies to: this one, or this and later lessons of its series. */
export function lessonsInScope(entries: ScheduleEntry[], target: ScheduleEntry, scope: SeriesScope) {
  if (scope === 'single' || !target.seriesId) return entries.filter((entry) => entry.id === target.id);
  return entries.filter((entry) => !entry.deleted && entry.seriesId === target.seriesId && entry.date >= target.date);
}

export const isRepeating = (entry: Pick<ScheduleEntry, 'seriesId'>) => Boolean(entry.seriesId);
