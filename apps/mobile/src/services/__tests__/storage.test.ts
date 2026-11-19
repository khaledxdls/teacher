import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadSchedule, saveEntries, saveWeeklyReminder } from '../storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

describe('storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns defaults when nothing is stored', async () => {
    await expect(loadSchedule()).resolves.toEqual({ entries: [], templates: [], classes: [], weeklyReminder: true });
  });

  it('round-trips saved values', async () => {
    const entries = [{ id: '1', date: '2026-11-13', startTime: '09:00', endTime: '10:00', subject: 'Math', className: '7B', room: '' }];
    await saveEntries(entries);
    await saveWeeklyReminder(false);
    const loaded = await loadSchedule();
    expect(loaded.entries).toEqual(entries);
    expect(loaded.weeklyReminder).toBe(false);
  });

  it('ignores corrupted or non-array values instead of crashing', async () => {
    await AsyncStorage.setItem('teacher-schedule-v1', '{not json');
    await AsyncStorage.setItem('teacher-classes-v1', '{"name":"7B"}');
    const loaded = await loadSchedule();
    expect(loaded.entries).toEqual([]);
    expect(loaded.classes).toEqual([]);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });
});
