import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyPlannerState } from '../../domain/types';
import { classOf, lesson, student } from '../../test-utils/domainFixtures';
import { createKeyValueRepository } from '../repository/keyValueRepository';
import { createSqliteRepository } from '../repository/sqliteRepository';
import { changedRecords } from '../repository/types';
import { saveCollection } from '../storage';

/** A tiny in-memory stand-in for expo-sqlite covering the statements the repository uses. */
const mockDatabase = { rows: new Map<string, string>(), meta: new Map<string, string>(), writes: 0 };
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => ({
    execAsync: async () => undefined,
    withTransactionAsync: async (task: () => Promise<void>) => task(),
    runAsync: async (sql: string, ...params: string[]) => {
      if (sql.startsWith('INSERT INTO records')) {
        mockDatabase.rows.set(`${params[0]}\u0000${params[1]}`, params[2]);
        mockDatabase.writes += 1;
      } else if (sql.startsWith('INSERT OR REPLACE INTO meta')) {
        mockDatabase.meta.set(params[0], params[1]);
      }
    },
    getFirstAsync: async (_sql: string, key: string) => (mockDatabase.meta.has(key) ? { value: mockDatabase.meta.get(key) } : null),
    getAllAsync: async () => [...mockDatabase.rows].map(([key, data]) => ({ collection: key.split('\u0000')[0], data })),
  }),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('classpilot-schema', '2');
  mockDatabase.rows.clear();
  mockDatabase.meta.clear();
  mockDatabase.writes = 0;
});

describe('changedRecords', () => {
  it('lists only new or replaced records', () => {
    const unchanged = classOf('c1', 'A');
    const previous = { ...emptyPlannerState, classes: [unchanged, classOf('c2', 'B')] };
    const next = { ...previous, classes: [unchanged, classOf('c2', 'B renamed'), classOf('c3', 'C')] };
    expect(changedRecords(previous, next).map((change) => change.record.id)).toEqual(['c2', 'c3']);
    expect(changedRecords(previous, previous)).toEqual([]);
  });
});

describe('SQLite repository', () => {
  it('copies data from the AsyncStorage version once and upgrades embedded students', async () => {
    await saveCollection('classes', [{ ...classOf('c7b', '7B'), students: [{ id: 'ana', name: 'Ana' }] }] as never);
    await saveCollection('entries', [lesson({ id: 'l1', date: '2026-11-13' })]);

    const repository = createSqliteRepository();
    const loaded = await repository.load();
    expect(loaded.classes[0]).not.toHaveProperty('students');
    expect(loaded.students).toEqual([expect.objectContaining({ id: 'ana', classId: 'c7b', dirty: true })]);
    expect(loaded.entries.map((item) => item.id)).toEqual(['l1']);

    // The upgrade was written back, and the copy does not run again.
    const writesAfterFirstLoad = mockDatabase.writes;
    await AsyncStorage.setItem('classpilot-entries-v2', '[]');
    const reloaded = await createSqliteRepository().load();
    expect(reloaded.students.map((item) => item.id)).toEqual(['ana']);
    expect(reloaded.entries.map((item) => item.id)).toEqual(['l1']);
    expect(mockDatabase.writes).toBe(writesAfterFirstLoad);
  });

  it('writes only the records that changed', async () => {
    const repository = createSqliteRepository();
    const loaded = await repository.load();
    const withClass = { ...loaded, classes: [classOf('c7b', '7B')], students: [student('ana', 'Ana')] };
    await repository.save(loaded, withClass);
    const writes = mockDatabase.writes;

    await repository.save(withClass, { ...withClass, students: [...withClass.students, student('ben', 'Ben')] });
    expect(mockDatabase.writes).toBe(writes + 1);
    expect((await createSqliteRepository().load()).students.map((item) => item.id).sort()).toEqual(['ana', 'ben']);
  });
});

describe('key-value repository (web)', () => {
  it('upgrades embedded data on load and saves changed collections', async () => {
    await saveCollection('classes', [{ ...classOf('c7b', '7B'), students: [{ id: 'ana', name: 'Ana' }] }] as never);
    const repository = createKeyValueRepository();
    const loaded = await repository.load();
    expect(loaded.students.map((item) => item.id)).toEqual(['ana']);
    expect(JSON.parse((await AsyncStorage.getItem('classpilot-students-v2'))!)).toHaveLength(1);

    await repository.save(loaded, { ...loaded, classes: [classOf('c8a', '8A')] });
    expect(JSON.parse((await AsyncStorage.getItem('classpilot-classes-v2'))!)).toEqual([classOf('c8a', '8A')]);
  });
});
