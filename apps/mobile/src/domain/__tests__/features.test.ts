import { createBackup, mergeBackup, parseBackup } from '../backup';
import { indexScores } from '../grades';
import { foldLine, toIcs } from '../ics';
import { classInsights } from '../insights';
import { emptyPlannerState } from '../types';
import {
  assessment,
  attendanceMark,
  behaviorNote,
  classOf,
  homeworkMark,
  lesson,
  NOW,
  score,
  state,
  student,
} from '../../test-utils/domainFixtures';

describe('class insights', () => {
  const students = [student('ana', 'Ana'), student('ben', 'Ben'), student('cleo', 'Cleo')];
  const lessons = [
    lesson({ id: 'l1', date: '2026-11-06' }),
    lesson({ id: 'l2', date: '2026-11-13', plan: { homework: 'p1' } }),
    lesson({ id: 'l3', date: '2026-11-16', plan: { homework: 'p2' } }),
    lesson({ id: 'l4', date: '2026-11-17', plan: { homework: 'p3' } }),
    lesson({ id: 'future', date: '2026-12-01' }),
  ];
  const attendance = [
    ...['l1', 'l2', 'l3', 'l4'].map((id) => attendanceMark(id, 'ana', 'present')),
    attendanceMark('l1', 'ben', 'absent'), attendanceMark('l2', 'ben', 'absent'), attendanceMark('l3', 'ben', 'present'),
    attendanceMark('future', 'ben', 'absent'),
  ];
  const quiz = assessment({ id: 'q1', date: '2026-11-10' });
  const test = assessment({ id: 'q2', date: '2026-11-17' });
  const insights = classInsights({
    students,
    lessons,
    attendance,
    assessments: [test, quiz],
    scores: indexScores([score('q1', 'ana', 18), score('q1', 'ben', 6), score('q2', 'ana', 16), score('q2', 'ben', 8)]),
    homework: [homeworkMark('l2', 'cleo', 'missing'), homeworkMark('l3', 'cleo', 'missing'), homeworkMark('l4', 'cleo', 'missing'), homeworkMark('l2', 'ana', 'done')],
    behavior: ['1', '2', '3'].map((id) => behaviorNote(id, 'cleo', 'negative')),
    today: '2026-11-19',
    weeks: 3,
  });

  it('computes overall rates and averages, ignoring future lessons', () => {
    expect(insights.attendanceRate).toBe(71);
    expect(insights.homeworkRate).toBe(25);
    expect(insights.averageGrade).toBe(60);
  });

  it('builds weekly and per-assessment trends', () => {
    expect(insights.attendanceTrend).toEqual([
      { weekStart: '2026-10-30', rate: null },
      { weekStart: '2026-11-06', rate: 50 },
      { weekStart: '2026-11-13', rate: 80 },
    ]);
    expect(insights.gradeTrend.map((point) => [point.assessment.id, point.average])).toEqual([['q1', 60], ['q2', 60]]);
  });

  it('flags students at risk with reasons', () => {
    expect(insights.atRisk.map(({ student: item, reasons }) => [item.name, reasons.map((reason) => reason.kind)])).toEqual([
      ['Ben', ['attendance', 'grades']],
      ['Cleo', ['homework', 'behavior']],
    ]);
  });
});

describe('calendar export (ics)', () => {
  const ics = toIcs([
    { id: 'l1', date: '2026-11-20', startTime: '09:00', endTime: '10:30', title: 'Math, 7B; room', location: 'Room 12', description: 'Line one\nLine two' },
  ], { calendarName: 'ClassPilot', now: new Date(Date.UTC(2026, 10, 19, 8, 5, 3)) });

  it('produces a valid calendar with escaped text and floating local times', () => {
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('UID:l1@classpilot.app');
    expect(lines).toContain('DTSTAMP:20261119T080503Z');
    expect(lines).toContain('DTSTART:20261120T090000');
    expect(lines).toContain('DTEND:20261120T103000');
    expect(lines).toContain('SUMMARY:Math\\, 7B\\; room');
    expect(lines).toContain('DESCRIPTION:Line one\\nLine two');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('folds long lines at 75 octets without splitting multi-byte characters', () => {
    const folded = foldLine(`SUMMARY:${'ح'.repeat(60)}`);
    for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n ').join('')).toBe(`SUMMARY:${'ح'.repeat(60)}`);
  });
});

describe('backup', () => {
  const data = state({
    classes: [classOf('c7b', '7B', { dirty: true })],
    students: [student('ana', 'Ana')],
    entries: [lesson({ id: 'l1', date: '2026-11-13' })],
  });

  it('round-trips data without local dirty flags', () => {
    const parsed = parseBackup(createBackup(data, new Date(NOW)));
    if (!parsed.ok) throw new Error('parse failed');
    expect(parsed.value.classes[0]).toEqual(classOf('c7b', '7B'));
    expect(parsed.value.students).toEqual(data.students);
    expect(parsed.value.entries).toEqual(data.entries);
  });

  it.each([
    ['not json', '{'],
    ['another app', JSON.stringify({ format: 'other', version: 1, data: {} })],
    ['a newer version', JSON.stringify({ format: 'classpilot-backup', version: 99, data: {} })],
  ])('rejects %s', (_, text) => {
    expect(parseBackup(text)).toEqual({ ok: false, error: { code: 'backupInvalid', params: undefined } });
  });

  it('upgrades backups made before students were separate records', () => {
    const legacy = JSON.stringify({
      format: 'classpilot-backup', version: 1, exportedAt: '', data: {
        classes: [{ id: 'c7b', name: '7B', updatedAt: 1, students: [{ id: 'ana', name: 'Ana' }] }],
      },
    });
    const parsed = parseBackup(legacy);
    if (!parsed.ok) throw new Error('parse failed');
    expect(parsed.value.classes[0]).not.toHaveProperty('students');
    expect(parsed.value.students).toEqual([expect.objectContaining({ id: 'ana', classId: 'c7b', name: 'Ana' })]);
  });

  it('merges keeping the newest version of each record and marks imports for sync', () => {
    const local = state({ classes: [classOf('c7b', 'Newer name', { updatedAt: 10 }), classOf('old', 'Old', { updatedAt: 1 })] });
    const incoming = {
      ...emptyPlannerState,
      classes: [classOf('c7b', 'Older name', { updatedAt: 5 }), classOf('old', 'Renamed', { updatedAt: 7 }), classOf('new', 'New', { updatedAt: 3 })],
    };
    const { state: merged, summary } = mergeBackup(local, incoming, NOW);
    expect(summary).toEqual({ added: 1, updated: 1 });
    expect(merged.classes.map((item) => [item.id, item.name, Boolean(item.dirty)])).toEqual([
      ['c7b', 'Newer name', false], ['old', 'Renamed', true], ['new', 'New', true],
    ]);
  });
});
