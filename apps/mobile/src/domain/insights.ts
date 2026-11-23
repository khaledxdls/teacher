import { attendanceRate, studentAttendanceStats } from './attendance';
import { behaviorCountsByStudent } from './behavior';
import { addDays, dateKey, parseDateKey, weekStart } from './dates';
import { assessmentAverage, ScoreIndex, studentAverage } from './grades';
import { hasHomework, studentHomeworkStats } from './homework';
import { Assessment, AttendanceMark, BehaviorNote, DateKey, HomeworkMark, ScheduleEntry, Student } from './types';

/** When a student is flagged as needing attention. */
export const RISK_THRESHOLDS = {
  /** Attendance rate below this (with at least `minMarked` marked lessons). */
  attendanceRate: 85,
  minMarked: 3,
  /** Average grade below this percentage. */
  averageGrade: 50,
  /** This many missing homework or more. */
  missingHomework: 3,
  /** This many negative notes or more, outnumbering positive ones. */
  negativeBehavior: 3,
} as const;

export type RiskReason =
  | { kind: 'attendance'; rate: number }
  | { kind: 'grades'; average: number }
  | { kind: 'homework'; missing: number }
  | { kind: 'behavior'; negative: number };

export type AtRiskStudent = { student: Student; reasons: RiskReason[] };
export type WeekPoint = { weekStart: DateKey; rate: number | null };
export type GradePoint = { assessment: Assessment; average: number | null };

export type ClassInsights = {
  attendanceRate: number | null;
  homeworkRate: number | null;
  averageGrade: number | null;
  /** Attendance rate per teaching week, oldest first, ending with the current week. */
  attendanceTrend: WeekPoint[];
  /** Class average per assessment, oldest first. */
  gradeTrend: GradePoint[];
  atRisk: AtRiskStudent[];
};

export type InsightsInput = {
  students: Student[];
  /** The class's live lessons. */
  lessons: ScheduleEntry[];
  attendance: AttendanceMark[];
  /** The class's live assessments. */
  assessments: Assessment[];
  scores: ScoreIndex;
  homework: HomeworkMark[];
  behavior: BehaviorNote[];
  today: DateKey;
  weeks?: number;
  maxGradePoints?: number;
};

/** Overall rate across students: attended ÷ marked, 0–100, or null when nothing is marked. */
function overallRate<T extends { marked: number }>(stats: Iterable<T>, attended: (stat: T) => number) {
  let marked = 0;
  let total = 0;
  for (const stat of stats) {
    marked += stat.marked;
    total += attended(stat);
  }
  return marked ? Math.round((total / marked) * 100) : null;
}

const mean = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

function weeklyAttendance(lessons: ScheduleEntry[], marks: AttendanceMark[], today: DateKey, weeks: number): WeekPoint[] {
  const current = weekStart(parseDateKey(today));
  return Array.from({ length: weeks }, (_, index) => {
    const start = addDays(current, (index - weeks + 1) * 7);
    const from = dateKey(start);
    const to = dateKey(addDays(start, 6));
    const ids = new Set(lessons.filter((lesson) => lesson.date >= from && lesson.date <= to && lesson.date <= today).map((lesson) => lesson.id));
    let attended = 0;
    let marked = 0;
    for (const mark of marks) {
      if (mark.deleted || !ids.has(mark.lessonId)) continue;
      marked += 1;
      if (mark.status !== 'absent') attended += 1;
    }
    return { weekStart: from, rate: marked ? Math.round((attended / marked) * 100) : null };
  });
}

export function classInsights(input: InsightsInput): ClassInsights {
  const { students, lessons, attendance, assessments, scores, homework, behavior, today } = input;
  const pastLessonIds = new Set(lessons.filter((lesson) => lesson.date <= today).map((lesson) => lesson.id));
  const homeworkLessonIds = new Set(lessons.filter(hasHomework).map((lesson) => lesson.id));
  const studentIds = new Set(students.map((student) => student.id));

  const attendanceStats = studentAttendanceStats(attendance, pastLessonIds);
  const homeworkStats = studentHomeworkStats(homework, homeworkLessonIds);
  const behaviorCounts = behaviorCountsByStudent(behavior.filter((note) => studentIds.has(note.studentId)));

  const atRisk: AtRiskStudent[] = [];
  const studentAverages: number[] = [];
  for (const student of students) {
    const reasons: RiskReason[] = [];
    const attendanceStat = attendanceStats.get(student.id);
    const rate = attendanceStat ? attendanceRate(attendanceStat) : null;
    if (rate !== null && attendanceStat!.marked >= RISK_THRESHOLDS.minMarked && rate < RISK_THRESHOLDS.attendanceRate) {
      reasons.push({ kind: 'attendance', rate });
    }
    const average = studentAverage(assessments, scores, student.id);
    if (average !== null) {
      studentAverages.push(average);
      if (average < RISK_THRESHOLDS.averageGrade) reasons.push({ kind: 'grades', average });
    }
    const missing = homeworkStats.get(student.id)?.missing ?? 0;
    if (missing >= RISK_THRESHOLDS.missingHomework) reasons.push({ kind: 'homework', missing });
    const counts = behaviorCounts.get(student.id);
    if (counts && counts.negative >= RISK_THRESHOLDS.negativeBehavior && counts.negative > counts.positive) {
      reasons.push({ kind: 'behavior', negative: counts.negative });
    }
    if (reasons.length) atRisk.push({ student, reasons });
  }

  const chronological = [...assessments].sort((a, b) => a.date.localeCompare(b.date)).slice(-(input.maxGradePoints ?? 8));

  return {
    attendanceRate: overallRate(attendanceStats.values(), (stat) => stat.present + stat.late),
    homeworkRate: overallRate(homeworkStats.values(), (stat) => stat.done + stat.late),
    averageGrade: mean(studentAverages),
    attendanceTrend: weeklyAttendance(lessons, attendance, today, input.weeks ?? 8),
    gradeTrend: chronological.map((assessment) => ({ assessment, average: assessmentAverage(assessment, scores, students) })),
    atRisk: atRisk.sort((a, b) => b.reasons.length - a.reasons.length || a.student.name.localeCompare(b.student.name)),
  };
}

