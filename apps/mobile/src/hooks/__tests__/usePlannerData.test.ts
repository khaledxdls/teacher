import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ScheduleEntry, ScheduleTemplate } from '../../domain/schedule';
import * as notifications from '../../services/notifications';
import * as storage from '../../services/storage';
import { usePlannerData } from '../usePlannerData';

jest.mock('../../services/storage', () => ({
  loadSchedule: jest.fn(),
  saveEntries: jest.fn(async () => undefined),
  saveTemplates: jest.fn(async () => undefined),
  saveClasses: jest.fn(async () => undefined),
  saveWeeklyReminder: jest.fn(async () => undefined),
}));

jest.mock('../../services/notifications', () => ({
  requestNotificationPermission: jest.fn(async () => undefined),
  scheduleClassReminders: jest.fn(async () => undefined),
  scheduleWeeklyReminder: jest.fn(async () => undefined),
}));

const store = jest.mocked(storage);
const notify = jest.mocked(notifications);

type Stored = Awaited<ReturnType<typeof storage.loadSchedule>>;
const stored = (overrides: Partial<Stored> = {}): Stored =>
  ({ entries: [], templates: [], classes: [], weeklyReminder: true, ...overrides });

const entry = (overrides: Partial<ScheduleEntry> & Pick<ScheduleEntry, 'id' | 'date'>): ScheduleEntry =>
  ({ startTime: '09:00', endTime: '10:00', subject: 'Math', className: '7B', room: '', ...overrides });

const FRIDAY = new Date(2026, 10, 13);

async function renderLoaded(data: Stored = stored()) {
  store.loadSchedule.mockResolvedValue(data);
  const hook = await renderHook(() => usePlannerData());
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  return hook;
}

describe('usePlannerData', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('loading', () => {
    it('does not save or schedule anything until stored data has loaded', async () => {
      let resolveLoad: (data: Stored) => void = () => undefined;
      store.loadSchedule.mockReturnValue(new Promise((resolve) => { resolveLoad = resolve; }));
      const saved = [entry({ id: 'a', date: '2026-11-20' })];

      const { result } = await renderHook(() => usePlannerData());
      expect(result.current.hydrated).toBe(false);
      expect(store.saveEntries).not.toHaveBeenCalled();
      expect(store.saveClasses).not.toHaveBeenCalled();
      expect(store.saveTemplates).not.toHaveBeenCalled();
      expect(store.saveWeeklyReminder).not.toHaveBeenCalled();
      expect(notify.scheduleWeeklyReminder).not.toHaveBeenCalled();

      await act(async () => resolveLoad(stored({ entries: saved, weeklyReminder: false })));

      await waitFor(() => expect(result.current.hydrated).toBe(true));
      expect(store.saveEntries).toHaveBeenCalledTimes(1);
      expect(store.saveEntries).toHaveBeenCalledWith(saved);
      expect(store.saveWeeklyReminder).toHaveBeenCalledWith(false);
      expect(store.saveWeeklyReminder).not.toHaveBeenCalledWith(true);
      expect(notify.scheduleWeeklyReminder).toHaveBeenCalledTimes(1);
      expect(notify.scheduleClassReminders).toHaveBeenCalledWith(saved);
    });

    it('never overwrites stored data when loading fails', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      store.loadSchedule.mockRejectedValue(new Error('disk error'));

      const { result } = await renderHook(() => usePlannerData());
      await waitFor(() => expect(warn).toHaveBeenCalled());

      expect(result.current.hydrated).toBe(false);
      expect(store.saveEntries).not.toHaveBeenCalled();
      expect(store.saveClasses).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('migrates legacy templates and de-duplicates classes', async () => {
      const legacy: ScheduleTemplate = {
        id: 't', name: 'Old',
        entries: [{ day: 1, startTime: '09:00', endTime: '10:00', subject: 'Math', className: '7B', room: '' }],
      };
      const { result } = await renderLoaded(stored({
        templates: [legacy],
        entries: [entry({ id: '1', date: '2026-11-13', className: '7B' }), entry({ id: '2', date: '2026-11-14', className: '7b' })],
      }));

      expect(result.current.templates[0].entries[0].day).toBe(0);
      expect(result.current.classes.map((item) => item.name)).toEqual(['7B']);
    });
  });

  describe('entries', () => {
    it('adds, edits and deletes entries, rescheduling reminders each time', async () => {
      const { result } = await renderLoaded();

      await act(async () => { expect(result.current.saveEntry(entry({ id: 'a', date: '2026-11-20' }))).toBeNull(); });
      expect(result.current.entries).toHaveLength(1);

      await act(async () => { result.current.saveEntry(entry({ id: 'a', date: '2026-11-20', subject: 'Science' })); });
      expect(result.current.entries).toEqual([expect.objectContaining({ id: 'a', subject: 'Science' })]);

      await act(async () => result.current.deleteEntry('a'));
      expect(result.current.entries).toEqual([]);
      // Deleting the last class must still clear its reminder.
      expect(notify.scheduleClassReminders).toHaveBeenLastCalledWith([]);
      expect(store.saveEntries).toHaveBeenLastCalledWith([]);
    });

    it('rejects overlapping classes', async () => {
      const { result } = await renderLoaded(stored({ entries: [entry({ id: 'a', date: '2026-11-20', subject: 'Math' })] }));

      let error: string | null = null;
      await act(async () => { error = result.current.saveEntry(entry({ id: 'b', date: '2026-11-20', startTime: '09:30', endTime: '10:30' })); });

      expect(error).toBe('Math is already scheduled at this time.');
      expect(result.current.entries).toHaveLength(1);
    });
  });

  describe('classes and students', () => {
    it('reuses an existing class with the same name', async () => {
      const { result } = await renderLoaded(stored({ classes: [{ id: 'c1', name: '7B', students: [] }] }));

      let created = result.current.addClass(' 7b ');
      expect(created.id).toBe('c1');

      await act(async () => { created = result.current.addClass('8A'); });
      expect(created.name).toBe('8A');
      expect(result.current.classes.map((item) => item.name)).toEqual(['7B', '8A']);
    });

    it('adds and removes students, rejecting duplicates', async () => {
      const { result } = await renderLoaded(stored({ classes: [{ id: 'c1', name: '7B', students: [] }] }));

      await act(async () => { expect(result.current.addStudent('c1', 'Ana')).toBeNull(); });
      expect(result.current.addStudent('c1', ' ana ')).toBe('This student is already in the class.');

      const [student] = result.current.classes[0].students;
      expect(student.name).toBe('Ana');

      await act(async () => result.current.removeStudent('c1', student.id));
      expect(result.current.classes[0].students).toEqual([]);
    });
  });

  describe('templates', () => {
    it('requires a non-empty week to save and an existing template to apply', async () => {
      const { result } = await renderLoaded();
      expect(result.current.saveWeekAsTemplate(FRIDAY)).toBe('Add a class before saving a template.');
      expect(result.current.applyLatestTemplate(FRIDAY)).toBe('Save a week as a template first.');
    });

    it('copies a saved week onto the same weekdays of another week', async () => {
      const { result } = await renderLoaded(stored({
        entries: [entry({ id: 'fri', date: '2026-11-13' }), entry({ id: 'thu', date: '2026-11-19' })],
      }));

      await act(async () => { expect(result.current.saveWeekAsTemplate(FRIDAY)).toBeNull(); });
      expect(result.current.templates).toHaveLength(1);

      const nextFriday = new Date(2026, 10, 20);
      await act(async () => { expect(result.current.applyLatestTemplate(nextFriday)).toBeNull(); });

      const dates = result.current.entries.map((item) => item.date).sort();
      expect(dates).toEqual(['2026-11-13', '2026-11-19', '2026-11-20', '2026-11-26']);
    });
  });
});
