import { termOn } from '../../domain/calendar';
import { addDays, addMonths, dateKey, endOfMonth, startOfMonth } from '../../domain/dates';
import { DateRange } from '../../domain/reports';
import { CalendarEvent, ScheduleEntry } from '../../domain/types';

export type RangePreset = 'thisMonth' | 'lastMonth' | 'last30' | 'thisTerm' | 'allTime' | 'custom';

/** Presets offered for the given calendar (`thisTerm` only when today falls in a term). */
export function availablePresets(events: CalendarEvent[], today: Date): RangePreset[] {
  const presets: RangePreset[] = ['thisMonth', 'lastMonth', 'last30'];
  if (termOn(events, dateKey(today))) presets.push('thisTerm');
  return [...presets, 'allTime', 'custom'];
}

/** The date range a preset stands for. `custom` keeps the given range. */
export function rangeForPreset(preset: RangePreset, today: Date, events: CalendarEvent[], lessons: ScheduleEntry[], custom: DateRange): DateRange {
  switch (preset) {
    case 'thisMonth':
      return { from: dateKey(startOfMonth(today)), to: dateKey(endOfMonth(today)) };
    case 'lastMonth': {
      const lastMonth = addMonths(startOfMonth(today), -1);
      return { from: dateKey(lastMonth), to: dateKey(endOfMonth(lastMonth)) };
    }
    case 'last30':
      return { from: dateKey(addDays(today, -29)), to: dateKey(today) };
    case 'thisTerm': {
      const term = termOn(events, dateKey(today));
      return term ? { from: term.startDate, to: term.endDate } : custom;
    }
    case 'allTime': {
      const dates = lessons.map((lesson) => lesson.date).sort();
      return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : { from: dateKey(today), to: dateKey(today) };
    }
    case 'custom':
      return custom;
  }
}
