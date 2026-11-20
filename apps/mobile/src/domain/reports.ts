import { attendanceRate, StudentAttendanceStats } from './attendance';
import { inDateRange } from './dates';
import { sortEntries } from './schedule';
import { AttendanceStatus, DateKey, SavedClass, ScheduleEntry, Student } from './types';

export type DateRange = { from: DateKey; to: DateKey };

export type AttendanceReportRow = {
  student: Student;
  /** One status per lesson, in the same order as `lessons`. */
  statuses: (AttendanceStatus | undefined)[];
  stats: StudentAttendanceStats;
  rate: number | null;
};

export type AttendanceReport = {
  className: string;
  range: DateRange;
  lessons: Pick<ScheduleEntry, 'id' | 'date' | 'startTime' | 'subject'>[];
  rows: AttendanceReportRow[];
};

/** Attendance of every current student for the class's lessons within `range`. */
export function buildAttendanceReport(savedClass: SavedClass, entries: ScheduleEntry[], range: DateRange): AttendanceReport {
  const lessons = sortEntries(entries.filter((entry) =>
    !entry.deleted && entry.classId === savedClass.id && inDateRange(entry.date, range.from, range.to)));

  const rows = savedClass.students.map((student) => {
    const statuses = lessons.map((lesson) => lesson.attendance?.[student.id]);
    const stats: StudentAttendanceStats = { present: 0, late: 0, absent: 0, marked: 0 };
    for (const status of statuses) {
      if (!status) continue;
      stats[status] += 1;
      stats.marked += 1;
    }
    return { student, statuses, stats, rate: attendanceRate(stats) };
  });

  return {
    className: savedClass.name,
    range,
    lessons: lessons.map(({ id, date, startTime, subject }) => ({ id, date, startTime, subject })),
    rows,
  };
}

/** Translated text the exporters need; keeps this module free of UI concerns. */
export type ReportLabels = {
  title: string;
  student: string;
  present: string;
  late: string;
  absent: string;
  rate: string;
  status: Record<AttendanceStatus, string>;
  /** Formats a lesson column header, e.g. "Mon 12 Nov 09:00". */
  lessonHeader: (lesson: AttendanceReport['lessons'][number]) => string;
  /** Formats the date range line. */
  rangeLabel: string;
};

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV with one row per student and one column per lesson, followed by totals. */
export function toCsv(report: AttendanceReport, labels: ReportLabels): string {
  const header = [labels.student, ...report.lessons.map(labels.lessonHeader), labels.present, labels.late, labels.absent, labels.rate];
  const rows = report.rows.map((row) => [
    row.student.name,
    ...row.statuses.map((status) => (status ? labels.status[status] : '')),
    row.stats.present,
    row.stats.late,
    row.stats.absent,
    row.rate === null ? '' : `${row.rate}%`,
  ]);
  // BOM so Excel opens UTF-8 (accents, Arabic) correctly.
  return `﻿${[header, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/** Printable HTML table (used to produce the PDF). */
export function toHtml(report: AttendanceReport, labels: ReportLabels, direction: 'ltr' | 'rtl' = 'ltr'): string {
  const head = [labels.student, ...report.lessons.map(labels.lessonHeader), labels.rate]
    .map((cell) => `<th>${escapeHtml(cell)}</th>`).join('');
  const body = report.rows.map((row) => {
    const cells = row.statuses.map((status) => `<td class="${status ?? 'none'}">${status ? escapeHtml(labels.status[status]) : '–'}</td>`).join('');
    return `<tr><th scope="row">${escapeHtml(row.student.name)}</th>${cells}<td>${row.rate === null ? '–' : `${row.rate}%`}</td></tr>`;
  }).join('');

  return `<!doctype html><html dir="${direction}"><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Roboto, "Segoe UI", sans-serif; color: #172b4d; padding: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; } p { color: #718096; margin: 0 0 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 11px; }
    th, td { border: 1px solid #d9dfeb; padding: 4px 6px; text-align: center; }
    th[scope=row] { text-align: start; white-space: nowrap; }
    thead th { background: #f5f7fb; }
    .present { color: #13894a; } .late { color: #a87400; } .absent { color: #c0392b; font-weight: bold; } .none { color: #a2aab8; }
  </style></head><body>
    <h1>${escapeHtml(labels.title)}</h1><p>${escapeHtml(labels.rangeLabel)}</p>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  </body></html>`;
}
