import { AttendanceMark, AttendanceStatus, Student } from './types';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent'];

/** Cycles unmarked → present → late → absent → unmarked. */
export function nextAttendanceStatus(current: AttendanceStatus | undefined): AttendanceStatus | undefined {
  if (!current) return ATTENDANCE_STATUSES[0];
  return ATTENDANCE_STATUSES[ATTENDANCE_STATUSES.indexOf(current) + 1];
}

export type AttendanceByStudent = ReadonlyMap<string, AttendanceStatus>;

/** Live marks indexed by lesson, then student. */
export function indexAttendance(marks: AttendanceMark[]) {
  const byLesson = new Map<string, Map<string, AttendanceStatus>>();
  for (const mark of marks) {
    if (mark.deleted) continue;
    const lesson = byLesson.get(mark.lessonId) ?? new Map<string, AttendanceStatus>();
    lesson.set(mark.studentId, mark.status);
    byLesson.set(mark.lessonId, lesson);
  }
  return byLesson;
}

/** Counts for one lesson; only the given (current) students count, the rest are `unmarked`. */
export function attendanceSummary(statuses: AttendanceByStudent | undefined, students: Pick<Student, 'id'>[]) {
  const counts = { present: 0, late: 0, absent: 0, unmarked: 0 };
  for (const student of students) counts[statuses?.get(student.id) ?? 'unmarked'] += 1;
  return counts;
}

export type AttendanceCounts = Record<AttendanceStatus, number>;
export type StudentAttendanceStats = AttendanceCounts & { marked: number };
export const emptyAttendanceStats = (): StudentAttendanceStats => ({ present: 0, late: 0, absent: 0, marked: 0 });

/** Attendance totals per student across the given lessons. */
export function studentAttendanceStats(marks: AttendanceMark[], lessonIds: ReadonlySet<string>) {
  const stats = new Map<string, StudentAttendanceStats>();
  for (const mark of marks) {
    if (mark.deleted || !lessonIds.has(mark.lessonId)) continue;
    const current = stats.get(mark.studentId) ?? emptyAttendanceStats();
    current[mark.status] += 1;
    current.marked += 1;
    stats.set(mark.studentId, current);
  }
  return stats;
}

/** Share of marked lessons attended (present or late), 0–100, or null when nothing is marked. */
export const attendanceRate = ({ present, late, marked }: StudentAttendanceStats) =>
  marked ? Math.round(((present + late) / marked) * 100) : null;
