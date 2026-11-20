import {
  addDays,
  addDaysToKey,
  addMonths,
  dateKey,
  dateTimeOf,
  daysBetween,
  defaultEndTime,
  formatTime,
  inDateRange,
  isDateKey,
  parseDateKey,
  timeToMinutes,
  weekDays,
  weekStart,
} from '../dates';
import { FRIDAY } from '../../test-utils/domainFixtures';

describe('date keys', () => {
  it('formats and parses local dates', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    const parsed = parseDateKey('2026-11-19');
    expect([parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), parsed.getHours()]).toEqual([2026, 10, 19, 0]);
  });

  it.each([['2026-02-29', false], ['2024-02-29', true], ['2026-13-01', false], ['26-1-1', false], ['2026-11-19', true]])(
    'validates %s', (value, valid) => expect(isDateKey(value)).toBe(valid),
  );

  it('adds days to keys across months and checks inclusive ranges', () => {
    expect(addDaysToKey('2026-11-28', 5)).toBe('2026-12-03');
    expect(inDateRange('2026-11-13', '2026-11-13', '2026-11-20')).toBe(true);
    expect(inDateRange('2026-11-21', '2026-11-13', '2026-11-20')).toBe(false);
  });
});

describe('teaching week', () => {
  it.each([
    ['Friday', new Date(2026, 10, 13, 15)],
    ['Saturday', new Date(2026, 10, 14)],
    ['Thursday', new Date(2026, 10, 19, 23, 59)],
  ])('starts on the previous Friday for a %s', (_, date) => {
    expect(dateKey(weekStart(date))).toBe('2026-11-13');
    expect(weekStart(date).getHours()).toBe(0);
  });

  it('lists Friday to Thursday', () => {
    expect(weekDays(FRIDAY).map(dateKey)).toEqual([
      '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19',
    ]);
  });
});

describe('arithmetic', () => {
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

  it('counts whole days across DST changes', () => {
    expect(daysBetween(new Date(2026, 2, 27, 23), new Date(2026, 3, 2, 1))).toBe(6);
    expect(daysBetween(new Date(2026, 9, 23), new Date(2026, 10, 2))).toBe(10);
  });
});

describe('times', () => {
  it('converts times', () => {
    expect(timeToMinutes('09:15')).toBe(555);
    expect(formatTime(new Date(2000, 0, 1, 7, 5))).toBe('07:05');
    expect(dateTimeOf('2026-11-13', '09:30')).toEqual(new Date(2026, 10, 13, 9, 30));
  });

  it('defaults the end time to one hour later, capped at 23:59', () => {
    expect(defaultEndTime('09:15')).toBe('10:15');
    expect(defaultEndTime('23:30')).toBe('23:59');
  });
});
