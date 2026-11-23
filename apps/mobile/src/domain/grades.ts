import { Assessment, Score, Student } from './types';

/** Live scores indexed by assessment, then student. */
export type ScoreIndex = ReadonlyMap<string, ReadonlyMap<string, number>>;

export function indexScores(scores: Score[]): ScoreIndex {
  const index = new Map<string, Map<string, number>>();
  for (const score of scores) {
    if (score.deleted) continue;
    const byStudent = index.get(score.assessmentId) ?? new Map<string, number>();
    byStudent.set(score.studentId, score.value);
    index.set(score.assessmentId, byStudent);
  }
  return index;
}

/** Score as a percentage of the maximum, rounded to one decimal. */
export const percentage = (score: number, maxScore: number) => Math.round((score / maxScore) * 1000) / 10;

const average = (values: number[]) =>
  values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;

export const scoreOf = (index: ScoreIndex, assessmentId: string, studentId: string) => index.get(assessmentId)?.get(studentId);

/** A student's mean percentage across graded assessments, or null if none are graded. */
export const studentAverage = (assessments: Assessment[], index: ScoreIndex, studentId: string) =>
  average(assessments.flatMap((assessment) => {
    const score = scoreOf(index, assessment.id, studentId);
    return score === undefined ? [] : [percentage(score, assessment.maxScore)];
  }));

/** Class mean for one assessment (current students only), as a percentage. */
export const assessmentAverage = (assessment: Assessment, index: ScoreIndex, students: Pick<Student, 'id'>[]) =>
  average(students.flatMap((student) => {
    const score = scoreOf(index, assessment.id, student.id);
    return score === undefined ? [] : [percentage(score, assessment.maxScore)];
  }));

export const gradedCount = (assessment: Assessment, index: ScoreIndex, students: Pick<Student, 'id'>[]) =>
  students.filter((student) => scoreOf(index, assessment.id, student.id) !== undefined).length;

export const sortAssessments = (assessments: Assessment[]) =>
  [...assessments].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

/** Parses user input such as "17" or "17.5" (comma decimals allowed); '' means "not graded". */
export function parseScore(input: string): number | null | 'invalid' {
  const trimmed = input.trim().replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : 'invalid';
}
