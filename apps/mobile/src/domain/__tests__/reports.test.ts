import { tombstone } from '../records';
import { buildAttendanceReport, ReportLabels, toCsv, toHtml } from '../reports';
import { attendanceMark, classOf, lesson, NOW, student } from '../../test-utils/domainFixtures';

const savedClass = classOf('c7b', '7B');
const students = [student('s1', 'Ana'), student('s2', 'Ben, "Jr"')];
const entries = [
  lesson({ id: 'a', date: '2026-11-13' }),
  lesson({ id: 'b', date: '2026-11-20' }),
  lesson({ id: 'outside', date: '2026-12-20' }),
  lesson({ id: 'other-class', date: '2026-11-14', classId: 'x' }),
  tombstone(lesson({ id: 'deleted', date: '2026-11-15' }), NOW),
];
const marks = [
  attendanceMark('a', 's1', 'present'), attendanceMark('a', 's2', 'absent'), attendanceMark('b', 's1', 'late'),
  attendanceMark('outside', 's1', 'absent'), attendanceMark('other-class', 's1', 'absent'), attendanceMark('deleted', 's1', 'absent'),
];

const labels: ReportLabels = {
  title: '7B attendance',
  student: 'Student',
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  rate: 'Rate',
  status: { present: 'P', late: 'L', absent: 'A' },
  lessonHeader: (item) => `${item.date} ${item.startTime}`,
  rangeLabel: '13–30 Nov 2026',
};

describe('attendance report', () => {
  const report = buildAttendanceReport(savedClass, students, entries, marks, { from: '2026-11-01', to: '2026-11-30' });

  it('includes only live lessons of the class within the range', () => {
    expect(report.lessons.map((item) => item.id)).toEqual(['a', 'b']);
    expect(report.rows.map((row) => [row.student.name, row.statuses, row.rate])).toEqual([
      ['Ana', ['present', 'late'], 100],
      ['Ben, "Jr"', ['absent', undefined], 0],
    ]);
  });

  it('exports CSV with escaping and a UTF-8 BOM', () => {
    const csv = toCsv(report, labels);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Student,2026-11-13 09:00,2026-11-20 09:00,Present,Late,Absent,Rate',
      'Ana,P,L,1,1,0,100%',
      '"Ben, ""Jr""",A,,0,0,1,0%',
      '',
    ]);
  });

  it('exports escaped HTML with the requested direction', () => {
    const html = toHtml({ ...report, rows: [{ ...report.rows[0], student: student('x', '<script>') }] }, labels, 'rtl');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<td class="late">L</td>');
  });
});
