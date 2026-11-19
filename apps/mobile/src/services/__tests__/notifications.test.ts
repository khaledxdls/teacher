import * as Notifications from 'expo-notifications';
import { ScheduleEntry } from '../../domain/schedule';
import { scheduleClassReminders, scheduleWeeklyReminder } from '../notifications';

type Pending = { identifier: string; content: { data: Record<string, unknown> }; trigger: { date: Date } };

// In-memory stand-in for the OS notification queue.
const mockPending = new Map<string, Pending>();
let mockNextId = 0;
const mockTick = () => new Promise<void>((resolve) => setImmediate(() => resolve()));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getAllScheduledNotificationsAsync: jest.fn(async () => {
    await mockTick();
    return [...mockPending.values()];
  }),
  cancelScheduledNotificationAsync: jest.fn(async (identifier: string) => {
    await mockTick();
    mockPending.delete(identifier);
  }),
  scheduleNotificationAsync: jest.fn(async (request: Omit<Pending, 'identifier'>) => {
    await mockTick();
    const identifier = `n${mockNextId++}`;
    mockPending.set(identifier, { ...request, identifier });
    return identifier;
  }),
}));

const NOW = new Date(2026, 10, 19, 8, 0);
const ofKind = (kind: string) => [...mockPending.values()].filter((item) => item.content.data.kind === kind);
const entry = (id: string, date: string, startTime = '09:00'): ScheduleEntry =>
  ({ id, date, startTime, endTime: '23:59', subject: 'Math', className: '7B', room: '12' });

describe('notifications', () => {
  beforeEach(() => {
    mockPending.clear();
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
  });

  afterEach(() => jest.restoreAllMocks());

  it('schedules a reminder 15 minutes before each upcoming class only', async () => {
    await scheduleClassReminders([
      entry('past', '2026-11-18'),
      entry('too-soon', '2026-11-19', '08:10'),
      entry('upcoming', '2026-11-19', '09:00'),
    ]);
    const reminders = ofKind('class-reminder');
    expect(reminders).toHaveLength(1);
    expect(reminders[0].content.data.entryId).toBe('upcoming');
    expect(reminders[0].trigger.date).toEqual(new Date(2026, 10, 19, 8, 45));
  });

  it('cancels old reminders when the last class is removed', async () => {
    await scheduleClassReminders([entry('a', '2026-11-20')]);
    expect(ofKind('class-reminder')).toHaveLength(1);
    await scheduleClassReminders([]);
    expect(ofKind('class-reminder')).toHaveLength(0);
  });

  it('caps class reminders to stay under the iOS limit of 64 alongside weekly reminders', async () => {
    const many = Array.from({ length: 100 }, (_, index) => entry(`e${index}`, `2026-12-${String((index % 28) + 1).padStart(2, '0')}`, `${String(8 + Math.floor(index / 28)).padStart(2, '0')}:00`));
    await scheduleWeeklyReminder(true);
    await scheduleClassReminders(many);
    expect(ofKind('class-reminder')).toHaveLength(40);
    expect(mockPending.size).toBeLessThanOrEqual(64);
    const scheduled = ofKind('class-reminder').map((item) => item.trigger.date.getTime());
    expect(Math.max(...scheduled)).toBeLessThan(new Date(2026, 11, 13).getTime());
  });

  it('does not create duplicates when reschedules overlap', async () => {
    await Promise.all([
      scheduleClassReminders([entry('a', '2026-11-20')]),
      scheduleClassReminders([entry('a', '2026-11-20')]),
      scheduleClassReminders([entry('a', '2026-11-20'), entry('b', '2026-11-21')]),
    ]);
    expect(ofKind('class-reminder').map((item) => item.content.data.entryId).sort()).toEqual(['a', 'b']);
  });

  it('keeps class and weekly reminders independent', async () => {
    await scheduleClassReminders([entry('a', '2026-11-20')]);
    await scheduleWeeklyReminder(true);
    expect(ofKind('weekly-reminder')).toHaveLength(12);
    await scheduleWeeklyReminder(false);
    expect(ofKind('weekly-reminder')).toHaveLength(0);
    expect(ofKind('class-reminder')).toHaveLength(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(12);
  });
});
