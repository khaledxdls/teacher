import { isSchoolDay } from '../calendar';
import { isDateKey, timeToMinutes } from '../dates';
import { fail } from '../errors';
import { lessonsInScope, occurrenceDates, Recurrence, SeriesScope } from '../recurrence';
import { alive, createId, findLive, setPairRecord, tombstone, touch, updateById } from '../records';
import { findScheduleConflict } from '../schedule';
import { AttendanceMark, AttendanceStatus, EntryDraft, HomeworkMark, HomeworkStatus, LessonPlan, pairId, PlannerState, ScheduleEntry } from '../types';
import { CommandContext, CommandResult, done } from './types';

export const NO_REPEAT: Recurrence = { frequency: 'none', until: '' };

export type SaveLessonInput = {
  draft: EntryDraft;
  /** Only used when creating a lesson. */
  recurrence?: Recurrence;
  /** Only used when editing a lesson that belongs to a series. */
  scope?: SeriesScope;
};

function validateDraft(draft: EntryDraft) {
  if (!draft.subject.trim()) return fail('subjectRequired');
  if (!draft.classId) return fail('classRequired');
  if (timeToMinutes(draft.endTime) <= timeToMinutes(draft.startTime)) return fail('endBeforeStart');
  return null;
}

function firstConflict(lessons: ScheduleEntry[], existing: ScheduleEntry[], ignoreIds: ReadonlySet<string>) {
  for (const lesson of lessons) {
    const conflict = findScheduleConflict(lesson, existing, ignoreIds);
    if (conflict) return fail('scheduleConflict', { subject: conflict.subject, date: conflict.date });
  }
  return null;
}

/** Fields an edit copies to the other lessons of a series (dates, notes and plans stay per lesson). */
const sharedFields = ({ subject, classId, startTime, endTime, room }: EntryDraft) => ({ subject, classId, startTime, endTime, room });

function createLessons(state: PlannerState, draft: EntryDraft, recurrence: Recurrence, ctx: CommandContext): CommandResult<{ count: number }> {
  if (recurrence.frequency !== 'none' && (!recurrence.until || recurrence.until < draft.date)) return fail('repeatUntilInvalid');

  const dates = occurrenceDates(draft.date, recurrence, (date) => isSchoolDay(state.events, date));
  const seriesId = dates.length > 1 ? createId() : undefined;
  const lessons: ScheduleEntry[] = dates.map((date, index) => ({
    ...draft,
    id: index === 0 ? draft.id : createId(),
    date,
    seriesId,
    // Notes and the lesson plan belong to the lesson the teacher filled in, not the whole series.
    notes: index === 0 ? draft.notes : '',
    plan: index === 0 ? draft.plan : undefined,
    notesDone: false,
    updatedAt: ctx.now,
    dirty: true,
  }));

  const conflict = firstConflict(lessons, alive(state.entries), new Set());
  if (conflict) return conflict;
  return done({ ...state, entries: [...state.entries, ...lessons] }, { count: lessons.length });
}

function editLessons(state: PlannerState, existing: ScheduleEntry, draft: EntryDraft, scope: SeriesScope, ctx: CommandContext): CommandResult<{ count: number }> {
  const targets = lessonsInScope(state.entries, existing, scope);
  const targetIds = new Set(targets.map((lesson) => lesson.id));
  const updated = targets.map((lesson) => (lesson.id === existing.id
    ? { ...lesson, ...draft, id: lesson.id, seriesId: lesson.seriesId }
    : { ...lesson, ...sharedFields(draft) }));

  const conflict = firstConflict(updated, alive(state.entries), targetIds);
  if (conflict) return conflict;

  const byId = new Map(updated.map((lesson) => [lesson.id, touch(lesson, ctx.now)]));
  return done({ ...state, entries: state.entries.map((lesson) => byId.get(lesson.id) ?? lesson) }, { count: updated.length });
}

/** Creates a lesson (optionally repeating) or edits one, or this-and-following lessons of its series. */
export function saveLesson(state: PlannerState, input: SaveLessonInput, ctx: CommandContext): CommandResult<{ count: number }> {
  const invalid = validateDraft(input.draft);
  if (invalid) return invalid;
  const draft = { ...input.draft, subject: input.draft.subject.trim(), room: input.draft.room.trim(), notes: input.draft.notes?.trim() };
  const existing = findLive(state.entries, draft.id);
  return existing
    ? editLessons(state, existing, draft, input.scope ?? 'single', ctx)
    : createLessons(state, draft, input.recurrence ?? NO_REPEAT, ctx);
}

export function deleteLesson(state: PlannerState, input: { id: string; scope?: SeriesScope }, ctx: CommandContext): CommandResult<{ count: number }> {
  const existing = findLive(state.entries, input.id);
  if (!existing) return fail('lessonMissing');
  const ids = new Set(lessonsInScope(state.entries, existing, input.scope ?? 'single').map((lesson) => lesson.id));
  const entries = state.entries.map((lesson) => (ids.has(lesson.id) ? tombstone(lesson, ctx.now) : lesson));
  return done({ ...state, entries }, { count: ids.size });
}

/** Updates after-class notes and whether the follow-up is done. */
export function updateLessonNotes(state: PlannerState, input: { id: string; notes: string; notesDone: boolean }, ctx: CommandContext): CommandResult {
  if (!findLive(state.entries, input.id)) return fail('lessonMissing');
  const entries = updateById(state.entries, input.id, (lesson) => ({ ...lesson, notes: input.notes.trim(), notesDone: input.notesDone }), ctx.now);
  return done({ ...state, entries });
}

export function setFollowUpDone(state: PlannerState, input: { id: string; done: boolean }, ctx: CommandContext): CommandResult {
  if (!findLive(state.entries, input.id)) return fail('lessonMissing');
  return done({ ...state, entries: updateById(state.entries, input.id, (lesson) => ({ ...lesson, notesDone: input.done }), ctx.now) });
}

/** Accepts "https://…", "http://…" or a bare domain ("docs.google.com/…", gets https://). */
export function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  const url = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return /^https?:\/\/[^\s/.]+\.[^\s]+$/i.test(url) ? url : null;
}

/** Replaces a lesson's plan (objectives, links and homework). */
export function saveLessonPlan(state: PlannerState, input: { lessonId: string; plan: LessonPlan }, ctx: CommandContext): CommandResult {
  if (!findLive(state.entries, input.lessonId)) return fail('lessonMissing');
  const resources = [];
  for (const resource of input.plan.resources ?? []) {
    if (!resource.url.trim() && !resource.label.trim()) continue;
    const url = normalizeUrl(resource.url);
    if (!url) return fail('linkInvalid', { link: resource.url.trim() || resource.label.trim() });
    resources.push({ id: resource.id || createId(), label: resource.label.trim() || url, url });
  }
  if (input.plan.homeworkDue && !isDateKey(input.plan.homeworkDue)) return fail('dateInvalid');
  const plan: LessonPlan = {
    objectives: input.plan.objectives?.trim() || undefined,
    resources: resources.length ? resources : undefined,
    homework: input.plan.homework?.trim() || undefined,
    homeworkDue: input.plan.homework?.trim() ? input.plan.homeworkDue : undefined,
  };
  const hasContent = Object.values(plan).some((value) => value !== undefined);
  const entries = updateById(state.entries, input.lessonId, (lesson) => ({ ...lesson, plan: hasContent ? plan : undefined }), ctx.now);
  return done({ ...state, entries });
}

function requireLessonStudent(state: PlannerState, lessonId: string, studentId: string) {
  const lesson = findLive(state.entries, lessonId);
  if (!lesson) return fail('lessonMissing');
  if (!findLive(state.students, studentId)) return fail('studentMissing');
  return null;
}

/** Sets one student's attendance in a lesson; `null` clears it. */
export function setAttendance(state: PlannerState, input: { lessonId: string; studentId: string; status: AttendanceStatus | null }, ctx: CommandContext): CommandResult {
  const invalid = requireLessonStudent(state, input.lessonId, input.studentId);
  if (invalid) return invalid;
  const fields = input.status ? { lessonId: input.lessonId, studentId: input.studentId, status: input.status } : null;
  return done({ ...state, attendance: setPairRecord<AttendanceMark>(state.attendance, pairId(input.lessonId, input.studentId), fields, ctx.now) });
}

/** Marks every current student of the lesson's class present. */
export function markAllPresent(state: PlannerState, input: { lessonId: string }, ctx: CommandContext): CommandResult {
  const lesson = findLive(state.entries, input.lessonId);
  if (!lesson) return fail('lessonMissing');
  let attendance = state.attendance;
  for (const student of alive(state.students).filter((item) => item.classId === lesson.classId)) {
    attendance = setPairRecord<AttendanceMark>(attendance, pairId(lesson.id, student.id), { lessonId: lesson.id, studentId: student.id, status: 'present' }, ctx.now);
  }
  return done({ ...state, attendance });
}

/** Sets whether one student handed in the lesson's homework; `null` clears it. */
export function setHomework(state: PlannerState, input: { lessonId: string; studentId: string; status: HomeworkStatus | null }, ctx: CommandContext): CommandResult {
  const invalid = requireLessonStudent(state, input.lessonId, input.studentId);
  if (invalid) return invalid;
  const fields = input.status ? { lessonId: input.lessonId, studentId: input.studentId, status: input.status } : null;
  return done({ ...state, homework: setPairRecord<HomeworkMark>(state.homework, pairId(input.lessonId, input.studentId), fields, ctx.now) });
}
