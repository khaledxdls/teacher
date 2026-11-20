import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyPlannerState } from '../../domain/types';
import {
  clearSyncCursor,
  defaultPreferences,
  loadPlannerState,
  loadPreferences,
  loadSyncCursor,
  saveCollection,
  savePreferences,
  saveSyncCursor,
} from '../storage';


describe('storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('planner state', () => {
    it('returns an empty planner on a fresh install', async () => {
      await expect(loadPlannerState()).resolves.toEqual(emptyPlannerState);
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

      // Later launches read the current keys and ignore v1.
      await AsyncStorage.setItem('teacher-schedule-v1', '[]');
      await expect(loadPlannerState()).resolves.toEqual(first);
    });

    it('round-trips every collection and fills collections missing from older saves', async () => {
      await AsyncStorage.setItem('classpilot-schema', '2');
      const events = [{ id: 'h', title: 'Break', kind: 'holiday' as const, startDate: '2026-12-20', endDate: '2027-01-03', updatedAt: 1 }];
      await saveCollection('events', events);
      const loaded = await loadPlannerState();
      expect(loaded).toEqual({ ...emptyPlannerState, events });
    });

    it('ignores corrupted or non-array values instead of crashing', async () => {
      await AsyncStorage.setItem('classpilot-schema', '2');
      await AsyncStorage.setItem('classpilot-entries-v2', '{not json');
      await AsyncStorage.setItem('classpilot-classes-v2', '{"name":"7B"}');
      await expect(loadPlannerState()).resolves.toEqual(emptyPlannerState);
      expect(console.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('preferences', () => {
    it('defaults, round-trips and migrates the legacy reminder flag', async () => {
      await expect(loadPreferences()).resolves.toEqual(defaultPreferences);

      await AsyncStorage.setItem('teacher-weekly-reminder-v1', 'false');
      await expect(loadPreferences()).resolves.toEqual({ ...defaultPreferences, weeklyReminder: false });

      await savePreferences({ weeklyReminder: true, theme: 'dark', language: 'ar' });
      await expect(loadPreferences()).resolves.toEqual({ weeklyReminder: true, theme: 'dark', language: 'ar' });
    });
  });

  describe('sync cursor', () => {
    it('stores the cursor and rejects malformed values', async () => {
      await expect(loadSyncCursor()).resolves.toBeNull();
      await saveSyncCursor({ userId: 'u1', cursor: 4, lastSyncedAt: 10 });
      await expect(loadSyncCursor()).resolves.toEqual({ userId: 'u1', cursor: 4, lastSyncedAt: 10 });
      await clearSyncCursor();
      await expect(loadSyncCursor()).resolves.toBeNull();
      await AsyncStorage.setItem('classpilot-sync-v2', '{"cursor":"x"}');
      await expect(loadSyncCursor()).resolves.toBeNull();
    });
  });
});
