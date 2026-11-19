import {
  addDays,
  addMonths,
  applyTemplateToWeek,
  createId,
  createWeekTemplate,
  dateKey,
  daysBetween,
  defaultEndTime,
  entriesInMonth,
  entriesInWeek,
  findScheduleConflict,
  formatTime,
  mergeClasses,
  migrateTemplate,
  parseDateKey,
  SavedClass,
  ScheduleEntry,
  ScheduleTemplate,
  sortEntries,
  timeToMinutes,
  weekDays,
  weekStart,
} from '../schedule';

const entry = (overrides: Partial<ScheduleEntry> & Pick<ScheduleEntry, 'id' | 'date'>): ScheduleEntry => ({
  startTime: '09:00',
  endTime: '10:00',
  subject: 'Math',
  className: '7B',
  room: '',
  ...overrides,
});

// Friday 13 Nov 2026 starts the teaching week that contains Thursday 19 Nov.
const FRIDAY = new Date(2026, 10, 13);

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

describe('ids', () => {
  it('creates unique ids even within the same millisecond', () => {
    const ids = Array.from({ length: 1000 }, createId);
    expect(new Set(ids).size).toBe(ids.length);
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

describe('mergeClasses', () => {
  it('removes duplicate names case-insensitively and repairs missing students', () => {
    const saved = [
      { id: '7B', name: '7B', students: [{ id: 's1', name: 'Ana' }] },
      { id: '7B', name: '7b ', students: [] },
      { id: 'x', name: '8A', students: undefined },
    ] as unknown as SavedClass[];

    const merged = mergeClasses(saved, []);
    expect(merged.map((item) => item.name)).toEqual(['7B', '8A']);
    expect(merged[0].students).toEqual([{ id: 's1', name: 'Ana' }]);
    expect(merged[1].students).toEqual([]);
  });

  it('adds one class per new class name used by entries', () => {
    const merged = mergeClasses([], [
      entry({ id: '1', date: '2026-11-13', className: '9C' }),
      entry({ id: '2', date: '2026-11-14', className: '9c' }),
      entry({ id: '3', date: '2026-11-15', className: '10A' }),
      entry({ id: '4', date: '2026-11-16', className: '  ' }),
    ]);
    expect(merged.map((item) => item.name)).toEqual(['9C', '10A']);
    expect(new Set(merged.map((item) => item.id)).size).toBe(2);
  });

  it('gives every class a unique id', () => {
    const merged = mergeClasses(
      [{ id: 'same', name: 'A', students: [] }, { id: 'same', name: 'B', students: [] }],
      [],
    );
    expect(merged[0].id).toBe('same');
    expect(merged[1].id).not.toBe('same');
  });
});

describe('templates', () => {
  const week = [
    entry({ id: 'fri', date: '2026-11-13', notes: 'homework' }),
    entry({ id: 'thu', date: '2026-11-19', startTime: '11:00', endTime: '12:00', subject: 'Science' }),
  ];

  it('stores 0-based day indexes without ids or notes', () => {
    const template = createWeekTemplate('T', week, FRIDAY);
    expect(template.version).toBe(2);
    expect(template.entries).toEqual([
      { day: 0, startTime: '09:00', endTime: '10:00', subject: 'Math', className: '7B', room: '' },
      { day: 6, startTime: '11:00', endTime: '12:00', subject: 'Science', className: '7B', room: '' },
    ]);
  });

  it('applies classes to the same weekdays of another week', () => {
    const template = createWeekTemplate('T', week, FRIDAY);
    const nextFriday = addDays(FRIDAY, 7);
    const result = applyTemplateToWeek(template, [], nextFriday);
    expect(result.map((item) => [item.date, item.subject, item.notes])).toEqual([
      ['2026-11-20', 'Math', ''],
      ['2026-11-26', 'Science', ''],
    ]);
  });

  it('replaces classes only on the days the template covers', () => {
    const template = createWeekTemplate('T', week, FRIDAY);
    const nextFriday = addDays(FRIDAY, 7);
    const current = [
      entry({ id: 'replaced', date: '2026-11-20' }),
      entry({ id: 'kept', date: '2026-11-21' }),
    ];
    const result = applyTemplateToWeek(template, current, nextFriday);
    expect(result.map((item) => item.id)).toContain('kept');
    expect(result.map((item) => item.id)).not.toContain('replaced');
    expect(result).toHaveLength(3);
  });

  it('round-trips the same week onto itself', () => {
    const template = createWeekTemplate('T', week, FRIDAY);
    expect(applyTemplateToWeek(template, week, FRIDAY).map((item) => item.date).sort()).toEqual(['2026-11-13', '2026-11-19']);
  });

  it('migrates legacy templates that were saved one day late', () => {
    const legacy: ScheduleTemplate = {
      id: 'old',
      name: 'Old',
      entries: [
        { day: 1, startTime: '09:00', endTime: '10:00', subject: 'Math', className: '7B', room: '' },
        { day: 7, startTime: '11:00', endTime: '12:00', subject: 'Science', className: '7B', room: '' },
      ],
    };
    const migrated = migrateTemplate(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.entries.map((item) => item.day)).toEqual([0, 6]);
    expect(migrateTemplate(migrated)).toBe(migrated);
  });

  it('ignores out-of-range days', () => {
    const template: ScheduleTemplate = {
      id: 't', name: 'T', version: 2,
      entries: [{ day: 9, startTime: '09:00', endTime: '10:00', subject: 'Math', className: '7B', room: '' }],
    };
    expect(applyTemplateToWeek(template, [], FRIDAY)).toEqual([]);
  });
});
