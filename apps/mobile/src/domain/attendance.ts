import { AttendanceStatus, ScheduleEntry, Student } from './types';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent'];

/** Cycles unmarked → present → late → absent → unmarked. */
export function nextAttendanceStatus(current: AttendanceStatus | undefined): AttendanceStatus | undefined {
  if (!current) return ATTENDANCE_STATUSES[0];
  return ATTENDANCE_STATUSES[ATTENDANCE_STATUSES.indexOf(current) + 1];
}

export type AttendanceCounts = Record<AttendanceStatus, number>;
const emptyCounts = (): AttendanceCounts => ({ present: 0, late: 0, absent: 0 });

/** Counts for one lesson; only current students count, the rest are `unmarked`. */
export function attendanceSummary(entry: Pick<ScheduleEntry, 'attendance'>, students: Student[]) {
  const counts = { ...emptyCounts(), unmarked: 0 };
  for (const student of students) counts[entry.attendance?.[student.id] ?? 'unmarked'] += 1;
  return counts;
}

export type StudentAttendanceStats = AttendanceCounts & { marked: number };

/** Attendance totals per student id across all lessons of a class. */
export function studentAttendanceStats(entries: ScheduleEntry[], classId: string) {
  const stats = new Map<string, StudentAttendanceStats>();
  for (const entry of entries) {
    if (entry.classId !== classId || !entry.attendance) continue;
    for (const [studentId, status] of Object.entries(entry.attendance)) {
      const current = stats.get(studentId) ?? { ...emptyCounts(), marked: 0 };
      current[status] += 1;
      current.marked += 1;
      stats.set(studentId, current);
    }
  }
  return stats;
}

/** Share of marked lessons attended (present or late), 0–100, or null when nothing is marked. */
export const attendanceRate = ({ present, late, marked }: StudentAttendanceStats) =>
  marked ? Math.round(((present + late) / marked) * 100) : null;

export const markAllPresent = (students: Student[]): Record<string, AttendanceStatus> =>
  Object.fromEntries(students.map((student) => [student.id, 'present' as const]));
