import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearSyncCursor,
  loadPlannerState,
  loadSyncCursor,
  loadWeeklyReminder,
  saveEntries,
  saveSyncCursor,
  saveWeeklyReminder,
} from '../storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

describe('storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns an empty planner on a fresh install', async () => {
    await expect(loadPlannerState()).resolves.toEqual({ entries: [], classes: [], templates: [] });
    await expect(loadWeeklyReminder()).resolves.toBe(true);
  });

  it('migrates v1 data once and keeps the v1 keys as a backup', async () => {
    const legacyEntries = JSON.stringify([
      { id: 'e1', date: '2026-11-13', startTime: '09:00', endTime: '10:00', subject: 'Math', className: '7B', room: '' },
    ]);
    await AsyncStorage.setItem('teacher-schedule-v1', legacyEntries);
    await AsyncStorage.setItem('teacher-classes-v1', JSON.stringify([{ id: 'k1', name: '7B', students: [] }]));

    const first = await loadPlannerState();
    expect(first.entries[0]).toMatchObject({ id: 'e1', classId: 'k1', dirty: true });
    expect(await AsyncStorage.getItem('classpilot-schema')).toBe('2');
    expect(await AsyncStorage.getItem('teacher-schedule-v1')).toBe(legacyEntries);

    // Later launches read v2 and ignore v1, so v1 edits made by an old build are not re-imported.
    await AsyncStorage.setItem('teacher-schedule-v1', '[]');
    await expect(loadPlannerState()).resolves.toEqual(first);
  });

  it('round-trips saved values', async () => {
    await AsyncStorage.setItem('classpilot-schema', '2');
    const entries = [{ id: '1', date: '2026-11-13', startTime: '09:00', endTime: '10:00', subject: 'Math', classId: 'k1', room: '', updatedAt: 5 }];
    await saveEntries(entries);
    await saveWeeklyReminder(false);
    expect((await loadPlannerState()).entries).toEqual(entries);
    await expect(loadWeeklyReminder()).resolves.toBe(false);
  });

  it('ignores corrupted or non-array values instead of crashing', async () => {
    await AsyncStorage.setItem('classpilot-schema', '2');
    await AsyncStorage.setItem('classpilot-entries-v2', '{not json');
    await AsyncStorage.setItem('classpilot-classes-v2', '{"name":"7B"}');
    const loaded = await loadPlannerState();
    expect(loaded.entries).toEqual([]);
    expect(loaded.classes).toEqual([]);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('stores the sync cursor and rejects malformed values', async () => {
    await expect(loadSyncCursor()).resolves.toBeNull();
    await saveSyncCursor({ userId: 'u1', cursor: 4, lastSyncedAt: 10 });
    await expect(loadSyncCursor()).resolves.toEqual({ userId: 'u1', cursor: 4, lastSyncedAt: 10 });
    await clearSyncCursor();
    await expect(loadSyncCursor()).resolves.toBeNull();
    await AsyncStorage.setItem('classpilot-sync-v2', '{"cursor":"x"}');
    await expect(loadSyncCursor()).resolves.toBeNull();
  });
});
