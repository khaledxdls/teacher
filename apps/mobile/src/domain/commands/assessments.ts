import { isDateKey } from '../dates';
import { fail } from '../errors';
import { alive, findLive, removeById, setPairRecord, touch, upsert } from '../records';
import { Assessment, AssessmentDraft, pairId, PlannerState, Score } from '../types';
import { CommandContext, CommandResult, done } from './types';

const liveScoresOf = (state: PlannerState, assessmentId: string) =>
  alive(state.scores).filter((score) => score.assessmentId === assessmentId);

/** Creates or updates an assessment's details (title, date, maximum score). */
export function saveAssessment(state: PlannerState, draft: AssessmentDraft, ctx: CommandContext): CommandResult<Assessment> {
  const title = draft.title.trim();
  if (!title) return fail('assessmentTitleRequired');
  if (!Number.isFinite(draft.maxScore) || draft.maxScore <= 0) return fail('assessmentMaxInvalid');
  if (!findLive(state.classes, draft.classId)) return fail('classMissing');
  if (!isDateKey(draft.date)) return fail('dateInvalid');
  // Lowering the maximum must not leave scores above it.
  if (liveScoresOf(state, draft.id).some((score) => score.value > draft.maxScore)) return fail('scoreOutOfRange', { max: draft.maxScore });

  const assessment = touch<Assessment>({ id: draft.id, classId: draft.classId, title, date: draft.date, maxScore: draft.maxScore, updatedAt: 0 }, ctx.now);
  return done({ ...state, assessments: upsert(state.assessments, assessment) }, assessment);
}

/** Sets one student's score; `null` clears it. */
export function setScore(state: PlannerState, input: { assessmentId: string; studentId: string; score: number | null }, ctx: CommandContext): CommandResult {
  const assessment = findLive(state.assessments, input.assessmentId);
  if (!assessment) return fail('assessmentMissing');
  if (input.score !== null && (!Number.isFinite(input.score) || input.score < 0 || input.score > assessment.maxScore)) {
    return fail('scoreOutOfRange', { max: assessment.maxScore });
  }
  const fields = input.score === null ? null : { assessmentId: assessment.id, studentId: input.studentId, value: input.score };
  return done({ ...state, scores: setPairRecord<Score>(state.scores, pairId(assessment.id, input.studentId), fields, ctx.now) });
}

export function deleteAssessment(state: PlannerState, input: { id: string }, ctx: CommandContext): CommandResult {
  if (!findLive(state.assessments, input.id)) return fail('assessmentMissing');
  return done({ ...state, assessments: removeById(state.assessments, input.id, ctx.now) });
}
