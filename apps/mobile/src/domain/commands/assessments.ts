import { isDateKey } from '../dates';
import { fail } from '../errors';
import { findLive, removeById, touch, updateById, upsert } from '../records';
import { Assessment, AssessmentDraft, PlannerState } from '../types';
import { CommandContext, CommandResult, done } from './types';

/** Creates or updates an assessment's details (title, date, maximum score). Scores are kept. */
export function saveAssessment(state: PlannerState, draft: AssessmentDraft, ctx: CommandContext): CommandResult<Assessment> {
  const title = draft.title.trim();
  if (!title) return fail('assessmentTitleRequired');
  if (!Number.isFinite(draft.maxScore) || draft.maxScore <= 0) return fail('assessmentMaxInvalid');
  if (!findLive(state.classes, draft.classId)) return fail('classMissing');
  if (!isDateKey(draft.date)) return fail('dateInvalid');

  const existing = findLive(state.assessments, draft.id);
  const assessment = touch<Assessment>({ ...existing, ...draft, title, scores: existing?.scores ?? draft.scores ?? {}, updatedAt: 0 }, ctx.now);
  // Lowering the maximum must not leave scores above it.
  const outOfRange = Object.values(assessment.scores).some((score) => score > assessment.maxScore);
  if (outOfRange) return fail('scoreOutOfRange', { max: assessment.maxScore });
  return done({ ...state, assessments: upsert(state.assessments, assessment) }, assessment);
}

/** Sets one student's score; `null` clears it. */
export function setScore(state: PlannerState, input: { assessmentId: string; studentId: string; score: number | null }, ctx: CommandContext): CommandResult {
  const assessment = findLive(state.assessments, input.assessmentId);
  if (!assessment) return fail('assessmentMissing');
  if (input.score !== null && (!Number.isFinite(input.score) || input.score < 0 || input.score > assessment.maxScore)) {
    return fail('scoreOutOfRange', { max: assessment.maxScore });
  }
  const assessments = updateById(state.assessments, assessment.id, (item) => {
    const scores = { ...item.scores };
    if (input.score === null) delete scores[input.studentId];
    else scores[input.studentId] = input.score;
    return { ...item, scores };
  }, ctx.now);
  return done({ ...state, assessments });
}

export function deleteAssessment(state: PlannerState, input: { id: string }, ctx: CommandContext): CommandResult {
  if (!findLive(state.assessments, input.id)) return fail('assessmentMissing');
  return done({ ...state, assessments: removeById(state.assessments, input.id, ctx.now) });
}
