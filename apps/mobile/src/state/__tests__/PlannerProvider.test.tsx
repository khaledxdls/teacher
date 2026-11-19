import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { dateKey, EntryDraft, PlannerState, SavedClass, ScheduleEntry } from '../../domain/schedule';
import * as notifications from '../../services/notifications';
import * as storage from '../../services/storage';
import { PlannerProvider, usePlanner } from '../PlannerProvider';

jest.mock('../../services/storage', () => ({
  loadPlannerState: jest.fn(),
  loadWeeklyReminder: jest.fn(async () => true),
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

const FRIDAY = new Date(2026, 10, 13);
const wrapper = ({ children }: { children: ReactNode }) => <PlannerProvider>{children}</PlannerProvider>;

const cls = (id: string, name: string, extra: Partial<SavedClass> = {}): SavedClass => ({ id, name, students: [], updatedAt: 1, ...extra });
const entry = (overrides: Partial<ScheduleEntry> & Pick<ScheduleEntry, 'id' | 'date'>): ScheduleEntry =>
  ({ startTime: '09:00', endTime: '10:00', subject: 'Math', classId: 'k1', room: '', updatedAt: 1, ...overrides });
const draft = (overrides: Partial<EntryDraft> & Pick<EntryDraft, 'id' | 'date'>): EntryDraft =>
  ({ startTime: '09:00', endTime: '10:00', subject: 'Math', classId: 'k1', room: '', ...overrides });

async function renderLoaded(data: Partial<PlannerState> = {}) {
  store.loadPlannerState.mockResolvedValue({ entries: [], classes: [], templates: [], ...data });
  const hook = await renderHook(() => usePlanner(), { wrapper });
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  return hook;
}

describe('PlannerProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('loading', () => {
    it('does not save or schedule anything until stored data has loaded', async () => {
      let resolveLoad: (data: PlannerState) => void = () => undefined;
      store.loadPlannerState.mockReturnValue(new Promise((resolve) => { resolveLoad = resolve; }));
      const saved = [entry({ id: 'a', date: '2026-11-20' })];

      const { result } = await renderHook(() => usePlanner(), { wrapper });
      expect(result.current.hydrated).toBe(false);
      expect(store.saveEntries).not.toHaveBeenCalled();
      expect(store.saveClasses).not.toHaveBeenCalled();
      expect(notify.scheduleClassReminders).not.toHaveBeenCalled();
      expect(notify.scheduleWeeklyReminder).not.toHaveBeenCalled();

      await act(async () => resolveLoad({ entries: saved, classes: [cls('k1', '7B')], templates: [] }));
      await waitFor(() => expect(result.current.hydrated).toBe(true));

      expect(store.saveEntries).toHaveBeenCalledWith(saved);
      expect(store.saveEntries).not.toHaveBeenCalledWith([]);
      expect(notify.scheduleClassReminders).toHaveBeenCalledWith([expect.objectContaining({ id: 'a', className: '7B' })]);
    });

    it('never overwrites stored data when loading fails', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      store.loadPlannerState.mockRejectedValue(new Error('disk error'));
      const { result } = await renderHook(() => usePlanner(), { wrapper });
      await waitFor(() => expect(warn).toHaveBeenCalled());
      expect(result.current.hydrated).toBe(false);
      expect(store.saveEntries).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('hides deleted records but still resolves deleted class names', async () => {
      const { result } = await renderLoaded({
        classes: [cls('k1', '7B'), cls('gone', 'Old class', { deleted: true })],
        entries: [entry({ id: 'a', date: '2026-11-20' }), entry({ id: 'b', date: '2026-11-21', deleted: true })],
      });
      expect(result.current.classes.map((item) => item.name)).toEqual(['7B']);
      expect(result.current.entries.map((item) => item.id)).toEqual(['a']);
      expect(result.current.classById.get('gone')?.name).toBe('Old class');
    });
  });

  describe('entries', () => {
    it('adds, edits and deletes entries as dirty records with tombstones', async () => {
      const { result } = await renderLoaded({ classes: [cls('k1', '7B')] });

      await act(async () => { expect(result.current.saveEntry(draft({ id: 'a', date: '2026-11-20' }))).toBeNull(); });
      expect(result.current.entries[0]).toMatchObject({ id: 'a', dirty: true, updatedAt: expect.any(Number) });

      await act(async () => { result.current.saveEntry(draft({ id: 'a', date: '2026-11-20', subject: 'Science', attendance: { s1: 'present' } })); });
      expect(result.current.entries).toEqual([expect.objectContaining({ id: 'a', subject: 'Science', attendance: { s1: 'present' } })]);

      await act(async () => result.current.deleteEntry('a'));
      expect(result.current.entries).toEqual([]);
      expect(result.current.getState().entries).toEqual([expect.objectContaining({ id: 'a', deleted: true, dirty: true })]);
      // Deleting the last class must still clear its reminder.
      expect(notify.scheduleClassReminders).toHaveBeenLastCalledWith([]);
    });

    it('rejects overlapping classes', async () => {
      const { result } = await renderLoaded({ entries: [entry({ id: 'a', date: '2026-11-20' })] });
      let error: string | null = null;
      await act(async () => { error = result.current.saveEntry(draft({ id: 'b', date: '2026-11-20', startTime: '09:30', endTime: '10:30' })); });
      expect(error).toBe('Math is already scheduled at this time.');
      expect(result.current.entries).toHaveLength(1);
    });

    it('ignores deleted entries when checking for conflicts', async () => {
      const { result } = await renderLoaded({ entries: [entry({ id: 'a', date: '2026-11-20', deleted: true })] });
      await act(async () => { expect(result.current.saveEntry(draft({ id: 'b', date: '2026-11-20' }))).toBeNull(); });
    });
  });

  describe('classes and students', () => {
    it('reuses an existing class with the same name', async () => {
      const { result } = await renderLoaded({ classes: [cls('k1', '7B')] });
      expect(result.current.addClass(' 7b ').id).toBe('k1');

      let created: SavedClass | undefined;
      await act(async () => { created = result.current.addClass('8A'); });
      expect(created).toMatchObject({ name: '8A', dirty: true });
      expect(result.current.classes.map((item) => item.name)).toEqual(['7B', '8A']);
    });

    it('renames classes, rejecting empty and duplicate names', async () => {
      const { result } = await renderLoaded({ classes: [cls('k1', '7B'), cls('k2', '8A')] });
      expect(result.current.renameClass('k1', '  ')).toBe('Enter a class name first.');
      expect(result.current.renameClass('k1', '8a')).toBe('Another class already has this name.');
      await act(async () => { expect(result.current.renameClass('k1', '7B Maths')).toBeNull(); });
      expect(result.current.classById.get('k1')).toMatchObject({ name: '7B Maths', dirty: true });
    });

    it('only deletes classes without upcoming lessons or templates', async () => {
      const future = dateKey(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      const { result } = await renderLoaded({
        classes: [cls('busy', 'Busy'), cls('templated', 'Templated'), cls('free', 'Free')],
        entries: [entry({ id: 'a', date: future, classId: 'busy' }), entry({ id: 'past', date: '2020-01-01', classId: 'free' })],
        templates: [{ id: 't', name: 'T', updatedAt: 1, entries: [{ day: 0, startTime: '09:00', endTime: '10:00', subject: 'Art', classId: 'templated', room: '' }] }],
      });
      expect(result.current.deleteClass('busy')).toBe('This class is still used by 1 upcoming class. Remove those first.');
      expect(result.current.deleteClass('templated')).toBe('This class is still used by 1 template. Remove those first.');

      await act(async () => { expect(result.current.deleteClass('free')).toBeNull(); });
      expect(result.current.classes.map((item) => item.id)).toEqual(['busy', 'templated']);
      expect(result.current.classById.get('free')?.deleted).toBe(true);
    });

    it('adds and removes students, rejecting duplicates', async () => {
      const { result } = await renderLoaded({ classes: [cls('k1', '7B')] });
      await act(async () => { expect(result.current.addStudent('k1', 'Ana')).toBeNull(); });
      expect(result.current.addStudent('k1', ' ana ')).toBe('This student is already in the class.');
      expect(result.current.addStudent('k1', '')).toBe('Enter a student name first.');
      expect(result.current.addStudent('missing', 'Ben')).toBe('This class no longer exists.');

      const [student] = result.current.classes[0].students;
      await act(async () => result.current.removeStudent('k1', student.id));
      expect(result.current.classes[0].students).toEqual([]);
    });
  });

  describe('templates', () => {
    it('saves a named template and applies it to another week', async () => {
      const { result } = await renderLoaded({
        entries: [entry({ id: 'fri', date: '2026-11-13' }), entry({ id: 'thu', date: '2026-11-19' })],
      });
      expect(result.current.saveWeekAsTemplate(new Date(2026, 10, 27), 'Empty')).toBe('Add a class before saving a template.');

      await act(async () => { expect(result.current.saveWeekAsTemplate(FRIDAY, 'Week A')).toBeNull(); });
      const [template] = result.current.templates;
      expect(template.name).toBe('Week A');

      await act(async () => { expect(result.current.applyTemplate(template.id, new Date(2026, 10, 20))).toBeNull(); });
      expect(result.current.entries.map((item) => item.date).sort()).toEqual(['2026-11-13', '2026-11-19', '2026-11-20', '2026-11-26']);
    });

    it('renames and deletes templates', async () => {
      const { result } = await renderLoaded({ templates: [{ id: 't', name: 'Old', updatedAt: 1, entries: [] }] });
      expect(result.current.renameTemplate('t', ' ')).toBe('Enter a template name first.');
      await act(async () => { result.current.renameTemplate('t', 'New'); });
      expect(result.current.templates[0].name).toBe('New');
      await act(async () => result.current.deleteTemplate('t'));
      expect(result.current.templates).toEqual([]);
      expect(result.current.applyTemplate('t', FRIDAY)).toBe('This template no longer exists.');
    });
  });
});
