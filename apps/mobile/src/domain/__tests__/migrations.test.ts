import { LegacyData, migrateFromV1 } from '../migrations';

const NOW = 1_700_000_000_000;

const legacy = (overrides: Partial<LegacyData> = {}): LegacyData => ({ entries: [], templates: [], classes: [], ...overrides });
const legacyEntry = (id: string, className: string, date = '2026-11-13') =>
  ({ id, date, startTime: '09:00', endTime: '10:00', subject: 'Math', className, room: '1' });

describe('migrateFromV1', () => {
  it('returns an empty state for a fresh install', () => {
    expect(migrateFromV1(legacy(), NOW)).toEqual({ entries: [], classes: [], templates: [] });
  });

  it('links entries to classes by id and keeps students', () => {
    const state = migrateFromV1(legacy({
      classes: [{ id: 'k1', name: '7B', students: [{ id: 's1', name: 'Ana' }] }],
      entries: [legacyEntry('e1', '7b'), legacyEntry('e2', ' 7B ')],
    }), NOW);

    expect(state.classes).toEqual([{ id: 'k1', name: '7B', students: [{ id: 's1', name: 'Ana' }], updatedAt: NOW, dirty: true }]);
    expect(state.entries.map((entry) => entry.classId)).toEqual(['k1', 'k1']);
    expect(state.entries[0]).not.toHaveProperty('className');
    expect(state.entries[0]).toMatchObject({ id: 'e1', subject: 'Math', room: '1', updatedAt: NOW, dirty: true });
  });

  it('creates classes for names only used by entries or templates', () => {
    const state = migrateFromV1(legacy({
      entries: [legacyEntry('e1', '9C'), legacyEntry('e2', '9c')],
      templates: [{ id: 't1', name: 'T', version: 2, entries: [{ day: 0, startTime: '09:00', endTime: '10:00', subject: 'Art', className: '10A', room: '' }] }],
    }), NOW);
    expect(state.classes.map((item) => item.name)).toEqual(['9C', '10A']);
    expect(state.templates[0].entries[0].classId).toBe(state.classes[1].id);
  });

  it('de-duplicates classes and repairs bad data', () => {
    const state = migrateFromV1(legacy({
      classes: [
        { id: 'same', name: '7B', students: [{ id: 's1', name: 'Ana' }] },
        { id: 'same', name: '7b', students: [] },
        { id: 'same', name: '8A' },
        { id: 'x', name: '   ' },
      ],
    }), NOW);
    expect(state.classes.map((item) => item.name)).toEqual(['7B', '8A']);
    expect(state.classes[1].students).toEqual([]);
    expect(new Set(state.classes.map((item) => item.id)).size).toBe(2);
  });

  it('shifts legacy template days that were saved one day late', () => {
    const entryFor = (day: number) => ({ day, startTime: '09:00', endTime: '10:00', subject: 'Math', className: '7B', room: '' });
    const state = migrateFromV1(legacy({
      templates: [
        { id: 'old', name: 'Old', entries: [entryFor(1), entryFor(7)] },
        { id: 'new', name: 'New', version: 2, entries: [entryFor(0), entryFor(6)] },
      ],
    }), NOW);
    expect(state.templates.map((template) => template.entries.map((entry) => entry.day))).toEqual([[0, 6], [0, 6]]);
    expect(state.templates[0]).toMatchObject({ updatedAt: NOW, dirty: true });
  });

  it('drops entries without a class name', () => {
    const state = migrateFromV1(legacy({ entries: [legacyEntry('e1', '')] }), NOW);
    expect(state.entries).toEqual([]);
  });
});
