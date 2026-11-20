import { emptyPlannerState, PlannerState, SavedClass, ScheduleEntry } from '../types';
import { applyRemote, collectDirty, countDirty, markAllDirty, markPushed, SyncRecord } from '../sync';

const cls = (id: string, updatedAt: number, extra: Partial<SavedClass> = {}): SavedClass =>
  ({ id, name: `Class ${id}`, students: [], updatedAt, ...extra });
const entry = (id: string, updatedAt: number, extra: Partial<ScheduleEntry> = {}): ScheduleEntry =>
  ({ id, date: '2026-11-13', startTime: '09:00', endTime: '10:00', subject: 'Math', classId: 'c1', room: '', updatedAt, ...extra });
const state = (overrides: Partial<PlannerState>): PlannerState => ({ ...emptyPlannerState, ...overrides });

describe('collectDirty', () => {
  it('returns only dirty records, without local-only fields', () => {
    const records = collectDirty(state({
      classes: [cls('c1', 5, { dirty: true }), cls('c2', 6)],
      entries: [entry('e1', 7, { dirty: true, deleted: true })],
    }));
    expect(records).toEqual([
      { collection: 'entry', id: 'e1', updatedAt: 7, deleted: true, data: expect.not.objectContaining({ dirty: true }) },
      { collection: 'class', id: 'c1', updatedAt: 5, deleted: false, data: { id: 'c1', name: 'Class c1', students: [] } },
    ]);
    expect(records[0].data).not.toHaveProperty('updatedAt');
    expect(records[0].data).not.toHaveProperty('deleted');
  });
});

describe('markPushed', () => {
  it('clears dirty only when the record did not change again during the request', () => {
    const before = state({ classes: [cls('c1', 5, { dirty: true }), cls('c2', 9, { dirty: true })] });
    const pushed = collectDirty(before);
    // c2 was edited again while the request was in flight.
    const during = state({ classes: [before.classes[0], cls('c2', 10, { dirty: true })] });
    const after = markPushed(during, pushed);
    expect(after.classes.map((item) => item.dirty)).toEqual([false, true]);
  });
});

describe('applyRemote', () => {
  const remote = (id: string, updatedAt: number, extra: Partial<SyncRecord> = {}): SyncRecord => ({
    collection: 'class', id, updatedAt, deleted: false, data: { id, name: `Remote ${id}`, students: [] }, ...extra,
  });

  it('adds new records from the server as clean', () => {
    const next = applyRemote(emptyPlannerState, [remote('c1', 5)]);
    expect(next.classes).toEqual([{ id: 'c1', name: 'Remote c1', students: [], updatedAt: 5, deleted: undefined, dirty: false }]);
  });

  it('replaces older local versions but keeps newer ones (last write wins)', () => {
    const local = state({ classes: [cls('older', 1, { dirty: true }), cls('newer', 10, { dirty: true })] });
    const next = applyRemote(local, [remote('older', 5), remote('newer', 5)]);
    expect(next.classes.find((item) => item.id === 'older')).toMatchObject({ name: 'Remote older', dirty: false });
    expect(next.classes.find((item) => item.id === 'newer')).toEqual(local.classes[1]);
  });

  it('applies remote deletions as tombstones', () => {
    const next = applyRemote(state({ classes: [cls('c1', 1)] }), [remote('c1', 2, { deleted: true })]);
    expect(next.classes[0]).toMatchObject({ id: 'c1', deleted: true });
  });

  it('routes records to the right collection', () => {
    const next = applyRemote(emptyPlannerState, [
      remote('e1', 1, { collection: 'entry', data: { id: 'e1', subject: 'Math' } }),
      remote('t1', 1, { collection: 'template', data: { id: 't1', name: 'T', entries: [] } }),
      remote('q1', 1, { collection: 'assessment', data: { id: 'q1', title: 'Quiz' } }),
      remote('h1', 1, { collection: 'event', data: { id: 'h1', title: 'Break' } }),
      remote('calendar', 1, { collection: 'setting', data: { id: 'calendar', rotation: { enabled: true, anchorWeek: null } } }),
      remote('x', 1, { collection: 'unknown' as never }),
    ]);
    expect(next.entries.map((item) => item.id)).toEqual(['e1']);
    expect(next.templates.map((item) => item.id)).toEqual(['t1']);
    expect(next.assessments.map((item) => item.id)).toEqual(['q1']);
    expect(next.events.map((item) => item.id)).toEqual(['h1']);
    expect(next.settings.map((item) => item.id)).toEqual(['calendar']);
  });

  it('returns the same object when nothing changed', () => {
    const local = state({ classes: [cls('c1', 5)] });
    expect(applyRemote(local, [remote('c1', 5)])).toBe(local);
    expect(applyRemote(local, [])).toBe(local);
  });
});

describe('countDirty', () => {
  it('counts dirty records across all collections', () => {
    expect(countDirty(state({ classes: [cls('c1', 1, { dirty: true })], entries: [entry('e1', 1, { dirty: true }), entry('e2', 1)] }))).toBe(2);
  });
});

describe('markAllDirty', () => {
  it('marks every record for upload', () => {
    const next = markAllDirty(state({ classes: [cls('c1', 1)], entries: [entry('e1', 1, { deleted: true })] }));
    expect(collectDirty(next).map((record) => record.id).sort()).toEqual(['c1', 'e1']);
  });
});
