import { LegacyData, migrateFromV1, normalizeState, upgradeEmbeddedRecords } from '../migrations';
import { emptyPlannerState, PlannerState } from '../types';
import { NOW, student } from '../../test-utils/domainFixtures';

const legacy = (overrides: Partial<LegacyData> = {}): LegacyData => ({ entries: [], templates: [], classes: [], ...overrides });
const legacyEntry = (id: string, className: string, date = '2026-11-13') =>
  ({ id, date, startTime: '09:00', endTime: '10:00', subject: 'Math', className, room: '1' });

describe('migrateFromV1', () => {
  it('returns an empty state for a fresh install', () => {
    expect(migrateFromV1(legacy(), NOW)).toEqual(emptyPlannerState);
  });

  it('links lessons to classes by id and makes students separate records', () => {
    const state = migrateFromV1(legacy({
      classes: [{ id: 'k1', name: '7B', students: [{ id: 's1', name: 'Ana' }] }],
      entries: [legacyEntry('e1', '7b'), legacyEntry('e2', ' 7B ')],
    }), NOW);

    expect(state.classes).toEqual([{ id: 'k1', name: '7B', updatedAt: NOW, dirty: true }]);
    expect(state.students).toEqual([{ id: 's1', name: 'Ana', classId: 'k1', updatedAt: NOW, dirty: true }]);
    expect(state.entries.map((entry) => entry.classId)).toEqual(['k1', 'k1']);
    expect(state.entries[0]).not.toHaveProperty('className');
  });

  it('creates classes for names only used by lessons or templates', () => {
    const state = migrateFromV1(legacy({
      entries: [legacyEntry('e1', '9C'), legacyEntry('e2', '9c')],
      templates: [{ id: 't1', name: 'T', version: 2, entries: [{ day: 0, startTime: '09:00', endTime: '10:00', subject: 'Art', className: '10A', room: '' }] }],
    }), NOW);
    expect(state.classes.map((item) => item.name)).toEqual(['9C', '10A']);
    expect(state.templates[0].entries[0].classId).toBe(state.classes[1].id);
  });

  it('de-duplicates classes and shifts legacy template days', () => {
    const entryFor = (day: number) => ({ day, startTime: '09:00', endTime: '10:00', subject: 'Math', className: '7B', room: '' });
    const state = migrateFromV1(legacy({
      classes: [{ id: 'same', name: '7B' }, { id: 'same', name: '7b' }, { id: 'same', name: '8A' }],
      templates: [
        { id: 'old', name: 'Old', entries: [entryFor(1), entryFor(7)] },
        { id: 'new', name: 'New', version: 2, entries: [entryFor(0), entryFor(6)] },
      ],
    }), NOW);
    expect(state.classes.map((item) => item.name)).toEqual(['7B', '8A']);
    expect(new Set(state.classes.map((item) => item.id)).size).toBe(2);
    expect(state.templates.map((template) => template.entries.map((entry) => entry.day))).toEqual([[0, 6], [0, 6]]);
  });
});

describe('upgradeEmbeddedRecords', () => {
  const embedded = {
    ...emptyPlannerState,
    classes: [{ id: 'c7b', name: '7B', updatedAt: 5, students: [{ id: 'ana', name: 'Ana', notes: 'x' }, { id: 'ben', name: 'Ben' }] }],
    assessments: [{ id: 'q', classId: 'c7b', title: 'Quiz', date: '2026-11-13', maxScore: 20, updatedAt: 5, scores: { ana: 18 } }],
    entries: [{ id: 'l1', date: '2026-11-13', startTime: '09:00', endTime: '10:00', subject: 'M', classId: 'c7b', room: '', updatedAt: 5, attendance: { ana: 'late', ben: 'absent' } }],
  } as unknown as PlannerState;

  it('moves students, scores and attendance into separate dirty records', () => {
    const upgraded = upgradeEmbeddedRecords(embedded, NOW);
    expect(upgraded.classes[0]).toEqual({ id: 'c7b', name: '7B', updatedAt: NOW, dirty: true });
    expect(upgraded.students.map((item) => [item.id, item.classId, item.notes])).toEqual([['ana', 'c7b', 'x'], ['ben', 'c7b', undefined]]);
    expect(upgraded.scores).toEqual([{ id: 'q:ana', assessmentId: 'q', studentId: 'ana', value: 18, updatedAt: NOW, dirty: true }]);
    expect(upgraded.attendance.map((mark) => [mark.id, mark.status])).toEqual([['l1:ana', 'late'], ['l1:ben', 'absent']]);
    expect(upgraded.assessments[0]).not.toHaveProperty('scores');
    expect(upgraded.entries[0]).not.toHaveProperty('attendance');
  });

  it('is idempotent and keeps existing separate records', () => {
    const withExisting = { ...embedded, students: [student('ana', 'Ana renamed')] };
    const upgraded = upgradeEmbeddedRecords(withExisting, NOW);
    expect(upgraded.students.map((item) => item.name)).toEqual(['Ana renamed', 'Ben']);
    expect(upgradeEmbeddedRecords(upgraded, NOW)).toBe(upgraded);
  });
});

describe('normalizeState', () => {
  it('adds missing collections, drops invalid ones and upgrades embedded data', () => {
    const entries = [{ id: 'e', date: '2026-11-13', startTime: '09:00', endTime: '10:00', subject: 'M', classId: 'c', room: '', updatedAt: 1 }];
    expect(normalizeState({ entries, assessments: 'broken' as never }, NOW)).toEqual({ ...emptyPlannerState, entries });
    const upgraded = normalizeState({ classes: [{ id: 'c', name: 'C', updatedAt: 1, students: [{ id: 's', name: 'S' }] }] as never }, NOW);
    expect(upgraded.students).toHaveLength(1);
  });
});
