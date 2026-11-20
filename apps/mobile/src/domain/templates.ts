import { addDays, dateKey, daysBetween, parseDateKey } from './dates';
import { createId, tombstone } from './records';
import { DateKey, ScheduleEntry, ScheduleTemplate } from './types';

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
 * Replaces every school day the template covers in the given week with the template's classes.
 * Replaced lessons become tombstones so the change syncs; holidays are left untouched.
 */
export function applyTemplateToWeek(
  template: ScheduleTemplate,
  entries: ScheduleEntry[],
  start: Date,
  now: number,
  isSchoolDay: (date: DateKey) => boolean = () => true,
): ScheduleEntry[] {
  const copied: ScheduleEntry[] = template.entries
    .filter((entry) => entry.day >= 0 && entry.day < 7)
    .map(({ day, ...entry }) => ({ ...entry, date: dateKey(addDays(start, day)) }))
    .filter((entry) => isSchoolDay(entry.date))
    .map((entry) => ({ ...entry, notes: '', id: createId(), updatedAt: now, dirty: true }));
  const coveredDays = new Set(copied.map((entry) => entry.date));
  return [
    ...entries.map((entry) => (!entry.deleted && coveredDays.has(entry.date) ? tombstone(entry, now) : entry)),
    ...copied,
  ];
}

/** Days (0 = Friday) that a template has lessons on, in order. */
export const templateDays = (template: ScheduleTemplate) =>
  [...new Set(template.entries.map((entry) => entry.day))].sort((a, b) => a - b);
