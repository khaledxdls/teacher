import {
  addDays,
  addMonths,
  alive,
  applyTemplateToWeek,
  attendanceSummary,
  createId,
  createWeekTemplate,
  dateKey,
  daysBetween,
  defaultEndTime,
  entriesInMonth,
  entriesInWeek,
  findScheduleConflict,
  formatTime,
  nextAttendanceStatus,
  parseDateKey,
  ScheduleEntry,
  ScheduleTemplate,
  sortEntries,
  studentAttendanceStats,
  timeToMinutes,
  tombstone,
  touch,
  weekDays,
  weekStart,
} from '../schedule';

const entry = (overrides: Partial<ScheduleEntry> & Pick<ScheduleEntry, 'id' | 'date'>): ScheduleEntry => ({
  startTime: '09:00',
  endTime: '10:00',
  subject: 'Math',
  classId: 'c7b',
  room: '',
  updatedAt: 1,
  ...overrides,
});

// Friday 13 Nov 2026 starts the teaching week that contains Thursday 19 Nov.
const FRIDAY = new Date(2026, 10, 13);
const NOW = 1_700_000_000_000;

describe('dates', () => {
  it('formats and parses date keys as local dates', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    const parsed = parseDateKey('2026-11-19');
    expect([parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), parsed.getHours()]).toEqual([2026, 10, 19, 0]);
  });

  it.each([
    ['Friday', new Date(2026, 10, 13, 15)],
    ['Saturday', new Date(2026, 10, 14)],
    ['Thursday', new Date(2026, 10, 19, 23, 59)],
  ])('starts the week on the previous Friday for a %s', (_, date) => {
    const start = weekStart(date);
    expect(dateKey(start)).toBe('2026-11-13');
    expect(start.getHours()).toBe(0);
  });

  it('lists the seven days of a week from Friday to Thursday', () => {
    expect(weekDays(FRIDAY).map(dateKey)).toEqual([
      '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19',
    ]);
  });

  it('adds days across month boundaries', () => {
    expect(dateKey(addDays(new Date(2026, 10, 28), 5))).toBe('2026-12-03');
  });

  it.each([
    [new Date(2026, 0, 31), 1, '2026-02-28'],
    [new Date(2024, 0, 31), 1, '2024-02-29'],
    [new Date(2026, 2, 31), -1, '2026-02-28'],
    [new Date(2026, 11, 15), 1, '2027-01-15'],
  ])('clamps the day when adding months (%s + %i)', (date, amount, expected) => {
    expect(dateKey(addMonths(date, amount))).toBe(expected);
  });

  it('counts whole days regardless of time of day or DST changes', () => {
    expect(daysBetween(new Date(2026, 2, 27, 23), new Date(2026, 3, 2, 1))).toBe(6);
    expect(daysBetween(new Date(2026, 9, 23), new Date(2026, 10, 2))).toBe(10);
    expect(daysBetween(FRIDAY, FRIDAY)).toBe(0);
  });
});

describe('times', () => {
  it('converts between times, minutes and dates', () => {
    expect(timeToMinutes('09:15')).toBe(555);
    expect(formatTime(new Date(2000, 0, 1, 7, 5))).toBe('07:05');
  });

  it('defaults the end time to one hour later, capped at 23:59', () => {
    expect(defaultEndTime('09:15')).toBe('10:15');
    expect(defaultEndTime('22:59')).toBe('23:59');
    expect(defaultEndTime('23:30')).toBe('23:59');
  });
});

describe('ids and sync metadata', () => {
  it('creates unique ids even within the same millisecond', () => {
    const ids = Array.from({ length: 1000 }, createId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('touch marks a record dirty with the new timestamp', () => {
    expect(touch(entry({ id: 'a', date: '2026-11-13' }), NOW)).toMatchObject({ updatedAt: NOW, dirty: true });
  });

  it('tombstones keep the record but hide it from alive()', () => {
    const records = [entry({ id: 'a', date: '2026-11-13' }), tombstone(entry({ id: 'b', date: '2026-11-13' }), NOW)];
    expect(records[1]).toMatchObject({ id: 'b', deleted: true, dirty: true, updatedAt: NOW });
    expect(alive(records).map((item) => item.id)).toEqual(['a']);
  });
});

describe('filtering and sorting', () => {
  const entries = [
    entry({ id: 'thu-late', date: '2026-11-19', startTime: '14:00', endTime: '15:00' }),
    entry({ id: 'before', date: '2026-11-12' }),
    entry({ id: 'fri', date: '2026-11-13' }),
    entry({ id: 'thu-early', date: '2026-11-19', startTime: '08:00', endTime: '09:00' }),
    entry({ id: 'next-week', date: '2026-11-20' }),
    entry({ id: 'december', date: '2026-12-01' }),
  ];

  it('sorts by date then start time', () => {
    expect(sortEntries(entries).map((item) => item.id)).toEqual(['before', 'fri', 'thu-early', 'thu-late', 'next-week', 'december']);
  });

  it('returns only the entries of the given teaching week, sorted', () => {
    expect(entriesInWeek(entries, FRIDAY).map((item) => item.id)).toEqual(['fri', 'thu-early', 'thu-late']);
  });

  it('returns only the entries of the given month', () => {
    expect(entriesInMonth(entries, new Date(2026, 11, 20)).map((item) => item.id)).toEqual(['december']);
  });
});

describe('findScheduleConflict', () => {
  const existing = [entry({ id: 'a', date: '2026-11-13', startTime: '09:00', endTime: '10:00' })];

  it('detects overlapping classes on the same day', () => {
    expect(findScheduleConflict(entry({ id: 'b', date: '2026-11-13', startTime: '09:30', endTime: '10:30' }), existing)?.id).toBe('a');
    expect(findScheduleConflict(entry({ id: 'b', date: '2026-11-13', startTime: '08:00', endTime: '11:00' }), existing)?.id).toBe('a');
  });

  it('allows back-to-back classes, other days, and editing the same entry', () => {
    expect(findScheduleConflict(entry({ id: 'b', date: '2026-11-13', startTime: '10:00', endTime: '11:00' }), existing)).toBeUndefined();
    expect(findScheduleConflict(entry({ id: 'b', date: '2026-11-14' }), existing)).toBeUndefined();
    expect(findScheduleConflict(entry({ id: 'a', date: '2026-11-13', startTime: '09:30', endTime: '10:30' }), existing)).toBeUndefined();
  });
});

describe('attendance', () => {
  const students = [{ id: 's1', name: 'Ana' }, { id: 's2', name: 'Ben' }, { id: 's3', name: 'Cleo' }];

  it('cycles unmarked → present → late → absent → unmarked', () => {
    expect(nextAttendanceStatus(undefined)).toBe('present');
    expect(nextAttendanceStatus('present')).toBe('late');
    expect(nextAttendanceStatus('late')).toBe('absent');
    expect(nextAttendanceStatus('absent')).toBeUndefined();
  });

  it('summarizes attendance for the current students only', () => {
    const summary = attendanceSummary({ attendance: { s1: 'present', s2: 'absent', gone: 'present' } }, students);
    expect(summary).toEqual({ present: 1, late: 0, absent: 1, unmarked: 1 });
  });

  it('totals attendance per student across a class', () => {
    const stats = studentAttendanceStats([
      entry({ id: 'a', date: '2026-11-13', attendance: { s1: 'present', s2: 'late' } }),
      entry({ id: 'b', date: '2026-11-14', attendance: { s1: 'absent' } }),
      entry({ id: 'c', date: '2026-11-15', classId: 'other', attendance: { s1: 'present' } }),
      entry({ id: 'd', date: '2026-11-16' }),
    ], 'c7b');
    expect(stats.get('s1')).toEqual({ present: 1, late: 0, absent: 1, marked: 2 });
    expect(stats.get('s2')).toEqual({ present: 0, late: 1, absent: 0, marked: 1 });
    expect(stats.has('s3')).toBe(false);
  });
});

describe('templates', () => {
  const week = [
    entry({ id: 'fri', date: '2026-11-13', notes: 'homework', attendance: { s1: 'present' } }),
    entry({ id: 'thu', date: '2026-11-19', startTime: '11:00', endTime: '12:00', subject: 'Science' }),
  ];

  it('stores 0-based day indexes and only the reusable fields', () => {
    const template = createWeekTemplate('Week A', week, FRIDAY, NOW);
    expect(template).toMatchObject({ name: 'Week A', updatedAt: NOW, dirty: true });
    expect(template.entries).toEqual([
      { day: 0, startTime: '09:00', endTime: '10:00', subject: 'Math', classId: 'c7b', room: '' },
      { day: 6, startTime: '11:00', endTime: '12:00', subject: 'Science', classId: 'c7b', room: '' },
    ]);
  });

  it('applies classes to the same weekdays of another week', () => {
    const template = createWeekTemplate('T', week, FRIDAY, NOW);
    const result = applyTemplateToWeek(template, [], addDays(FRIDAY, 7), NOW);
    expect(result.map((item) => [item.date, item.subject, item.notes, item.dirty])).toEqual([
      ['2026-11-20', 'Math', '', true],
      ['2026-11-26', 'Science', '', true],
    ]);
  });

  it('turns replaced classes into tombstones and keeps other days', () => {
    const template = createWeekTemplate('T', week, FRIDAY, NOW);
    const current = [
      entry({ id: 'replaced', date: '2026-11-20' }),
      entry({ id: 'kept', date: '2026-11-21' }),
    ];
    const result = applyTemplateToWeek(template, current, addDays(FRIDAY, 7), NOW);
    expect(result.find((item) => item.id === 'replaced')).toMatchObject({ deleted: true, dirty: true, updatedAt: NOW });
    expect(result.find((item) => item.id === 'kept')).toEqual(current[1]);
    expect(alive(result)).toHaveLength(3);
  });

  it('round-trips the same week onto itself', () => {
    const template = createWeekTemplate('T', week, FRIDAY, NOW);
    expect(alive(applyTemplateToWeek(template, week, FRIDAY, NOW)).map((item) => item.date).sort()).toEqual(['2026-11-13', '2026-11-19']);
  });

  it('ignores out-of-range days', () => {
    const template: ScheduleTemplate = {
      id: 't', name: 'T', updatedAt: NOW,
      entries: [{ day: 9, startTime: '09:00', endTime: '10:00', subject: 'Math', classId: 'c7b', room: '' }],
    };
    expect(applyTemplateToWeek(template, [], FRIDAY, NOW)).toEqual([]);
  });
});
