import { sortEntries } from './schedule';
import { HomeworkMark, HomeworkStatus, ScheduleEntry, Student } from './types';

export const HOMEWORK_STATUSES: HomeworkStatus[] = ['done', 'late', 'missing'];

/** Cycles unmarked → done → late → missing → unmarked. */
export function nextHomeworkStatus(current: HomeworkStatus | undefined): HomeworkStatus | undefined {
  if (!current) return HOMEWORK_STATUSES[0];
  return HOMEWORK_STATUSES[HOMEWORK_STATUSES.indexOf(current) + 1];
}

export const hasHomework = (lesson: ScheduleEntry) => Boolean(lesson.plan?.homework?.trim());

/** Lessons of a class that set homework, oldest first. */
export const lessonsWithHomework = (lessons: ScheduleEntry[], classId: string) =>
  sortEntries(lessons.filter((lesson) => lesson.classId === classId && hasHomework(lesson)));

/** Live marks indexed by lesson, then student. */
export function indexHomework(marks: HomeworkMark[]) {
  const byLesson = new Map<string, Map<string, HomeworkStatus>>();
  for (const mark of marks) {
    if (mark.deleted) continue;
    const lesson = byLesson.get(mark.lessonId) ?? new Map<string, HomeworkStatus>();
    lesson.set(mark.studentId, mark.status);
    byLesson.set(mark.lessonId, lesson);
  }
  return byLesson;
}

export function homeworkSummary(statuses: ReadonlyMap<string, HomeworkStatus> | undefined, students: Pick<Student, 'id'>[]) {
  const counts = { done: 0, late: 0, missing: 0, unmarked: 0 };
  for (const student of students) counts[statuses?.get(student.id) ?? 'unmarked'] += 1;
  return counts;
}

export type StudentHomeworkStats = Record<HomeworkStatus, number> & { marked: number };

/** Homework totals per student across the given lessons. */
export function studentHomeworkStats(marks: HomeworkMark[], lessonIds: ReadonlySet<string>) {
  const stats = new Map<string, StudentHomeworkStats>();
  for (const mark of marks) {
    if (mark.deleted || !lessonIds.has(mark.lessonId)) continue;
    const current = stats.get(mark.studentId) ?? { done: 0, late: 0, missing: 0, marked: 0 };
    current[mark.status] += 1;
    current.marked += 1;
    stats.set(mark.studentId, current);
  }
  return stats;
}

/** Share of marked homework handed in (done or late), 0–100, or null when nothing is marked. */
export const homeworkRate = ({ done, late, marked }: StudentHomeworkStats) =>
  marked ? Math.round(((done + late) / marked) * 100) : null;
