import { isDateKey } from '../dates';
import { fail } from '../errors';
import { createId, findLive, removeById, touch } from '../records';
import { BehaviorKind, BehaviorNote, DateKey, PlannerState } from '../types';
import { CommandContext, CommandResult, done } from './types';

export type BehaviorInput = { studentId: string; kind: BehaviorKind; date: DateKey; lessonId?: string; note?: string };

/** Records a quick positive or negative note for a student. */
export function addBehaviorNote(state: PlannerState, input: BehaviorInput, ctx: CommandContext): CommandResult<BehaviorNote> {
  const student = findLive(state.students, input.studentId);
  if (!student) return fail('studentMissing');
  if (!isDateKey(input.date)) return fail('dateInvalid');
  const note = touch<BehaviorNote>({
    id: createId(),
    studentId: student.id,
    classId: student.classId,
    lessonId: input.lessonId,
    date: input.date,
    kind: input.kind,
    note: input.note?.trim() || undefined,
    updatedAt: 0,
  }, ctx.now);
  return done({ ...state, behavior: [...state.behavior, note] }, note);
}

export function deleteBehaviorNote(state: PlannerState, input: { id: string }, ctx: CommandContext): CommandResult {
  if (!findLive(state.behavior, input.id)) return fail('behaviorMissing');
  return done({ ...state, behavior: removeById(state.behavior, input.id, ctx.now) });
}
