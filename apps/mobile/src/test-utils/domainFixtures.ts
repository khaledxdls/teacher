import { CommandContext } from '../domain/commands';
import {
  Assessment,
  CalendarEvent,
  emptyPlannerState,
  EntryDraft,
  PlannerState,
  SavedClass,
  ScheduleEntry,
  ScheduleTemplate,
} from '../domain/types';

/** Shared builders for domain tests. Defaults describe a Math lesson for class 7B. */

export const NOW = 1_700_000_000_000;
/** Friday 13 Nov 2026 starts the teaching week that contains Thursday 19 Nov. */
export const FRIDAY = new Date(2026, 10, 13);
export const ctx: CommandContext = { now: NOW, today: '2026-11-13' };

export const lesson = (overrides: Partial<ScheduleEntry> & Pick<ScheduleEntry, 'id' | 'date'>): ScheduleEntry => ({
  startTime: '09:00', endTime: '10:00', subject: 'Math', classId: 'c7b', room: '', updatedAt: 1, ...overrides,
});

export const draft = (overrides: Partial<EntryDraft> & Pick<EntryDraft, 'id' | 'date'>): EntryDraft => ({
  startTime: '09:00', endTime: '10:00', subject: 'Math', classId: 'c7b', room: '', ...overrides,
});

export const classOf = (id: string, name: string, overrides: Partial<SavedClass> = {}): SavedClass => ({
  id, name, students: [], updatedAt: 1, ...overrides,
});

export const template = (overrides: Partial<ScheduleTemplate> & Pick<ScheduleTemplate, 'id'>): ScheduleTemplate => ({
  name: 'Template', entries: [], updatedAt: 1, ...overrides,
});

export const assessment = (overrides: Partial<Assessment> & Pick<Assessment, 'id'>): Assessment => ({
  classId: 'c7b', title: 'Quiz', date: '2026-11-13', maxScore: 20, scores: {}, updatedAt: 1, ...overrides,
});

export const holiday = (id: string, startDate: string, endDate = startDate): CalendarEvent => ({
  id, title: 'Holiday', kind: 'holiday', startDate, endDate, updatedAt: 1,
});

export const state = (overrides: Partial<PlannerState> = {}): PlannerState => ({
  ...emptyPlannerState, classes: [classOf('c7b', '7B')], ...overrides,
});

/** Unwraps a successful command result, failing the test with the error otherwise. */
export function expectOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(`Expected success, got ${JSON.stringify(result.error)}`);
  return result.value;
}
