import { daysBetween, inDateRange, parseDateKey, weekStart } from './dates';
import { CALENDAR_SETTINGS_ID, CalendarEvent, CalendarSettings, DateKey } from './types';

export const defaultCalendarSettings: CalendarSettings = {
  id: CALENDAR_SETTINGS_ID,
  updatedAt: 0,
  rotation: { enabled: false, anchorWeek: null },
};

export const calendarSettingsOf = (settings: CalendarSettings[]) =>
  settings.find((item) => item.id === CALENDAR_SETTINGS_ID && !item.deleted) ?? defaultCalendarSettings;

const covering = (events: CalendarEvent[], kind: CalendarEvent['kind'], date: DateKey) =>
  events.find((event) => !event.deleted && event.kind === kind && inDateRange(date, event.startDate, event.endDate));

export const holidayOn = (events: CalendarEvent[], date: DateKey) => covering(events, 'holiday', date);
export const termOn = (events: CalendarEvent[], date: DateKey) => covering(events, 'term', date);

/** Lessons are not created on holidays (by templates or repeating lessons). */
export const isSchoolDay = (events: CalendarEvent[], date: DateKey) => !holidayOn(events, date);

export type RotationWeek = 'A' | 'B';

/** Week A/B for the teaching week containing `date`, or null when rotation is off. */
export function rotationWeek(settings: CalendarSettings, date: DateKey): RotationWeek | null {
  const { enabled, anchorWeek } = settings.rotation;
  if (!enabled || !anchorWeek) return null;
  const weeks = Math.round(daysBetween(weekStart(parseDateKey(anchorWeek)), weekStart(parseDateKey(date))) / 7);
  return ((weeks % 2) + 2) % 2 === 0 ? 'A' : 'B';
}

const KIND_ORDER: Record<CalendarEvent['kind'], number> = { term: 0, holiday: 1 };

/** Events sorted by start date, with terms before holidays on the same day. */
export const sortEvents = (events: CalendarEvent[]) =>
  [...events].sort((a, b) => a.startDate.localeCompare(b.startDate) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
