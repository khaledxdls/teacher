import { attendanceRate, attendanceSummary, markAllPresent, nextAttendanceStatus, studentAttendanceStats } from '../attendance';
import { calendarSettingsOf, holidayOn, isSchoolDay, rotationWeek, sortEvents, termOn } from '../calendar';
import { doneFollowUps, openFollowUps } from '../followUps';
import { assessmentAverage, gradedCount, parseScore, percentage, sortAssessments, studentAverage } from '../grades';
import { lessonsInScope, MAX_OCCURRENCES, occurrenceDates } from '../recurrence';
import { alive, createId, tombstone, touch, upsert } from '../records';
import { currentEntry, entriesInMonth, entriesInWeek, findScheduleConflict, nextEntry, sortEntries } from '../schedule';
import { applyTemplateToWeek, createWeekTemplate, templateDays } from '../templates';
import { CALENDAR_SETTINGS_ID, CalendarSettings } from '../types';
import { assessment, FRIDAY, holiday, lesson, NOW, template } from '../../test-utils/domainFixtures';

describe('records', () => {
  it('creates unique ids even within the same millisecond', () => {
    const ids = Array.from({ length: 1000 }, createId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('touches, tombstones, filters and upserts', () => {
    expect(touch(lesson({ id: 'a', date: '2026-11-13' }), NOW)).toMatchObject({ updatedAt: NOW, dirty: true });
    const records = [lesson({ id: 'a', date: '2026-11-13' }), tombstone(lesson({ id: 'b', date: '2026-11-13' }), NOW)];
    expect(records[1]).toMatchObject({ deleted: true, dirty: true });
    expect(alive(records).map((item) => item.id)).toEqual(['a']);
    expect(upsert(records, lesson({ id: 'a', date: '2026-11-14' }))[0].date).toBe('2026-11-14');
    expect(upsert(records, lesson({ id: 'c', date: '2026-11-14' }))).toHaveLength(3);
  });
});

describe('schedule', () => {
  const entries = [
    lesson({ id: 'thu-late', date: '2026-11-19', startTime: '14:00', endTime: '15:00' }),
    lesson({ id: 'before', date: '2026-11-12' }),
    lesson({ id: 'fri', date: '2026-11-13' }),
    lesson({ id: 'thu-early', date: '2026-11-19', startTime: '08:00', endTime: '09:00' }),
    lesson({ id: 'december', date: '2026-12-01' }),
  ];

  it('sorts and filters by week and month', () => {
    expect(sortEntries(entries).map((item) => item.id)).toEqual(['before', 'fri', 'thu-early', 'thu-late', 'december']);
    expect(entriesInWeek(entries, FRIDAY).map((item) => item.id)).toEqual(['fri', 'thu-early', 'thu-late']);
    expect(entriesInMonth(entries, new Date(2026, 11, 20)).map((item) => item.id)).toEqual(['december']);
  });

  it('detects overlaps but allows back-to-back lessons and ignored ids', () => {
    const existing = [lesson({ id: 'a', date: '2026-11-13' })];
    expect(findScheduleConflict(lesson({ id: 'b', date: '2026-11-13', startTime: '09:30', endTime: '10:30' }), existing)?.id).toBe('a');
    expect(findScheduleConflict(lesson({ id: 'b', date: '2026-11-13', startTime: '10:00', endTime: '11:00' }), existing)).toBeUndefined();
    expect(findScheduleConflict(lesson({ id: 'b', date: '2026-11-13' }), existing, new Set(['a']))).toBeUndefined();
  });

  it('finds the current and next lesson', () => {
    const now = new Date(2026, 10, 19, 8, 30);
    expect(currentEntry(entries, now)?.id).toBe('thu-early');
    expect(nextEntry(entries, now)?.id).toBe('thu-late');
    expect(nextEntry(entries, new Date(2027, 0, 1))).toBeUndefined();
  });
});

describe('recurrence', () => {
  const always = () => true;

  it('repeats weekly or every two weeks until the end date', () => {
    expect(occurrenceDates('2026-11-13', { frequency: 'weekly', until: '2026-12-04' }, always))
      .toEqual(['2026-11-13', '2026-11-20', '2026-11-27', '2026-12-04']);
    expect(occurrenceDates('2026-11-13', { frequency: 'biweekly', until: '2026-12-11' }, always))
      .toEqual(['2026-11-13', '2026-11-27', '2026-12-11']);
    expect(occurrenceDates('2026-11-13', { frequency: 'none', until: '' }, always)).toEqual(['2026-11-13']);
  });

  it('skips non-school days but always keeps the first lesson', () => {
    const notOn20th = (date: string) => date !== '2026-11-20' && date !== '2026-11-13';
    expect(occurrenceDates('2026-11-13', { frequency: 'weekly', until: '2026-11-27' }, notOn20th))
      .toEqual(['2026-11-13', '2026-11-27']);
  });

  it('caps very long series', () => {
    expect(occurrenceDates('2026-01-02', { frequency: 'weekly', until: '2030-01-01' }, always)).toHaveLength(MAX_OCCURRENCES);
  });

  it('selects this lesson or this and following lessons of the series', () => {
    const series = ['2026-11-13', '2026-11-20', '2026-11-27'].map((date, index) => lesson({ id: `s${index}`, date, seriesId: 'S' }));
    const entries = [...series, lesson({ id: 'other', date: '2026-11-27' }), tombstone(lesson({ id: 'gone', date: '2026-12-04', seriesId: 'S' }), NOW)];
    expect(lessonsInScope(entries, series[1], 'single').map((item) => item.id)).toEqual(['s1']);
    expect(lessonsInScope(entries, series[1], 'following').map((item) => item.id)).toEqual(['s1', 's2']);
    expect(lessonsInScope(entries, entries[3], 'following').map((item) => item.id)).toEqual(['other']);
  });
});

describe('calendar', () => {
  const events = [
    holiday('h1', '2026-12-20', '2027-01-03'),
    { ...holiday('t1', '2026-09-01', '2026-12-19'), kind: 'term' as const, title: 'Term 1' },
    tombstone(holiday('old', '2026-11-13'), NOW),
  ];

  it('finds holidays and terms covering a date, ignoring deleted events', () => {
    expect(holidayOn(events, '2026-12-25')?.id).toBe('h1');
    expect(holidayOn(events, '2026-11-13')).toBeUndefined();
    expect(termOn(events, '2026-11-13')?.title).toBe('Term 1');
    expect(isSchoolDay(events, '2027-01-03')).toBe(false);
    expect(isSchoolDay(events, '2027-01-04')).toBe(true);
    expect(sortEvents(events).map((event) => event.id)).toEqual(['t1', 'old', 'h1']);
  });

  it('labels Week A/B from an anchor week, in both directions', () => {
    const settings: CalendarSettings = { id: CALENDAR_SETTINGS_ID, updatedAt: 1, rotation: { enabled: true, anchorWeek: '2026-11-16' } };
    expect(rotationWeek(settings, '2026-11-13')).toBe('A');
    expect(rotationWeek(settings, '2026-11-20')).toBe('B');
    expect(rotationWeek(settings, '2026-11-27')).toBe('A');
    expect(rotationWeek(settings, '2026-11-06')).toBe('B');
    expect(rotationWeek({ ...settings, rotation: { enabled: false, anchorWeek: '2026-11-16' } }, '2026-11-13')).toBeNull();
    expect(calendarSettingsOf([]).rotation.enabled).toBe(false);
  });
});

describe('templates', () => {
  const week = [
    lesson({ id: 'fri', date: '2026-11-13', notes: 'homework', attendance: { s1: 'present' } }),
    lesson({ id: 'thu', date: '2026-11-19', startTime: '11:00', endTime: '12:00', subject: 'Science' }),
  ];

  it('stores 0-based days and only reusable fields', () => {
    const created = createWeekTemplate('Week A', week, FRIDAY, NOW);
    expect(created.entries).toEqual([
      { day: 0, startTime: '09:00', endTime: '10:00', subject: 'Math', classId: 'c7b', room: '' },
      { day: 6, startTime: '11:00', endTime: '12:00', subject: 'Science', classId: 'c7b', room: '' },
    ]);
    expect(templateDays(created)).toEqual([0, 6]);
  });

  it('replaces covered days with tombstones and skips holidays', () => {
    const created = createWeekTemplate('T', week, FRIDAY, NOW);
    const current = [lesson({ id: 'replaced', date: '2026-11-20' }), lesson({ id: 'kept', date: '2026-11-21' })];
    const result = applyTemplateToWeek(created, current, new Date(2026, 10, 20), NOW, (date) => date !== '2026-11-26');
    expect(result.find((item) => item.id === 'replaced')?.deleted).toBe(true);
    expect(alive(result).map((item) => item.date).sort()).toEqual(['2026-11-20', '2026-11-21']);
  });

  it('ignores out-of-range days', () => {
    const bad = template({ id: 't', entries: [{ day: 9, startTime: '09:00', endTime: '10:00', subject: 'Math', classId: 'c7b', room: '' }] });
    expect(applyTemplateToWeek(bad, [], FRIDAY, NOW)).toEqual([]);
  });
});

describe('attendance', () => {
  const students = [{ id: 's1', name: 'Ana' }, { id: 's2', name: 'Ben' }, { id: 's3', name: 'Cleo' }];

  it('cycles statuses and marks everyone present', () => {
    expect([undefined, 'present', 'late', 'absent'].map((status) => nextAttendanceStatus(status as never)))
      .toEqual(['present', 'late', 'absent', undefined]);
    expect(markAllPresent(students)).toEqual({ s1: 'present', s2: 'present', s3: 'present' });
  });

  it('summarizes a lesson and totals per student', () => {
    expect(attendanceSummary({ attendance: { s1: 'present', s2: 'absent', gone: 'present' } }, students))
      .toEqual({ present: 1, late: 0, absent: 1, unmarked: 1 });
    const stats = studentAttendanceStats([
      lesson({ id: 'a', date: '2026-11-13', attendance: { s1: 'present', s2: 'late' } }),
      lesson({ id: 'b', date: '2026-11-14', attendance: { s1: 'absent' } }),
      lesson({ id: 'c', date: '2026-11-15', classId: 'other', attendance: { s1: 'present' } }),
    ], 'c7b');
    expect(stats.get('s1')).toEqual({ present: 1, late: 0, absent: 1, marked: 2 });
    expect(attendanceRate(stats.get('s1')!)).toBe(50);
    expect(attendanceRate(stats.get('s2')!)).toBe(100);
  });
});

describe('grades', () => {
  const students = [{ id: 's1', name: 'Ana' }, { id: 's2', name: 'Ben' }];
  const quiz = assessment({ id: 'q', maxScore: 20, scores: { s1: 15, s2: 10, gone: 20 } });
  const test = assessment({ id: 't', maxScore: 50, scores: { s1: 50 }, date: '2026-12-01' });

  it('computes percentages and averages', () => {
    expect(percentage(15, 20)).toBe(75);
    expect(percentage(1, 3)).toBe(33.3);
    expect(studentAverage([quiz, test], 's1')).toBe(87.5);
    expect(studentAverage([quiz, test], 's3')).toBeNull();
    expect(assessmentAverage(quiz, students)).toBe(62.5);
    expect(gradedCount(test, students)).toBe(1);
    expect(sortAssessments([quiz, test]).map((item) => item.id)).toEqual(['t', 'q']);
  });

  it.each([['17', 17], [' 17,5 ', 17.5], ['', null], ['abc', 'invalid']])('parses "%s"', (input, expected) => {
    expect(parseScore(input)).toBe(expected);
  });
});

describe('follow-ups', () => {
  it('lists open notes oldest first and done notes newest first', () => {
    const entries = [
      lesson({ id: 'b', date: '2026-11-14', notes: 'Mark essays' }),
      lesson({ id: 'a', date: '2026-11-13', notes: 'Call parents' }),
      lesson({ id: 'blank', date: '2026-11-13', notes: '   ' }),
      lesson({ id: 'done', date: '2026-11-15', notes: 'Done', notesDone: true }),
    ];
    expect(openFollowUps(entries).map((item) => item.id)).toEqual(['a', 'b']);
    expect(doneFollowUps(entries).map((item) => item.id)).toEqual(['done']);
  });
});
