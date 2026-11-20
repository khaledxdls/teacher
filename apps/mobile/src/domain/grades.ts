import { Assessment, Student } from './types';

/** Score as a percentage of the maximum, rounded to one decimal. */
export const percentage = (score: number, maxScore: number) => Math.round((score / maxScore) * 1000) / 10;

const average = (values: number[]) =>
  values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;

/** A student's mean percentage across graded assessments, or null if none are graded. */
export const studentAverage = (assessments: Assessment[], studentId: string) =>
  average(assessments
    .filter((assessment) => assessment.scores[studentId] !== undefined)
    .map((assessment) => percentage(assessment.scores[studentId], assessment.maxScore)));

/** Class mean for one assessment (current students only), as a percentage. */
export const assessmentAverage = (assessment: Assessment, students: Student[]) =>
  average(students
    .filter((student) => assessment.scores[student.id] !== undefined)
    .map((student) => percentage(assessment.scores[student.id], assessment.maxScore)));

export const gradedCount = (assessment: Assessment, students: Student[]) =>
  students.filter((student) => assessment.scores[student.id] !== undefined).length;

export const sortAssessments = (assessments: Assessment[]) =>
  [...assessments].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

/** Parses user input such as "17" or "17.5" (comma decimals allowed); '' means "not graded". */
export function parseScore(input: string): number | null | 'invalid' {
  const trimmed = input.trim().replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : 'invalid';
}
