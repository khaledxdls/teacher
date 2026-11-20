import { commands } from '../commands';
import { alive } from '../records';
import { assessment, classOf, ctx, draft, expectOk, holiday, lesson, NOW, state, template } from '../../test-utils/domainFixtures';

const { saveLesson, deleteLesson, setFollowUpDone } = commands;

describe('lessons', () => {
  it('creates a single lesson as a dirty record', () => {
    const result = expectOk(saveLesson(state(), { draft: draft({ id: 'a', date: '2026-11-20', subject: ' Math ' }) }, ctx));
    expect(result.value.count).toBe(1);
    expect(result.state.entries).toEqual([expect.objectContaining({ id: 'a', subject: 'Math', dirty: true, updatedAt: NOW })]);
    expect(result.state.entries[0].seriesId).toBeUndefined();
  });

  it.each([
    [draft({ id: 'a', date: '2026-11-20', subject: ' ' }), 'subjectRequired'],
    [draft({ id: 'a', date: '2026-11-20', classId: '' }), 'classRequired'],
    [draft({ id: 'a', date: '2026-11-20', startTime: '10:00', endTime: '10:00' }), 'endBeforeStart'],
  ])('validates drafts (%#)', (input, code) => {
    expect(saveLesson(state(), { draft: input }, ctx)).toEqual({ ok: false, error: { code, params: undefined } });
  });

  it('creates a repeating series that skips holidays and keeps notes on the first lesson only', () => {
    const start = state({ events: [holiday('h', '2026-11-27')] });
    const result = expectOk(saveLesson(start, {
      draft: draft({ id: 'first', date: '2026-11-20', notes: 'Bring rulers', attendance: { s1: 'present' } }),
      recurrence: { frequency: 'weekly', until: '2026-12-11' },
    }, ctx));

    expect(result.value.count).toBe(3);
    const [first, ...rest] = result.state.entries;
    expect(result.state.entries.map((item) => item.date)).toEqual(['2026-11-20', '2026-12-04', '2026-12-11']);
    expect(new Set(result.state.entries.map((item) => item.seriesId)).size).toBe(1);
    expect(first).toMatchObject({ id: 'first', notes: 'Bring rulers', attendance: { s1: 'present' } });
    expect(rest.every((item) => item.notes === '' && item.attendance === undefined)).toBe(true);
  });

  it('rejects a repeat end date before the start and conflicts anywhere in the series', () => {
    expect(saveLesson(state(), { draft: draft({ id: 'a', date: '2026-11-20' }), recurrence: { frequency: 'weekly', until: '2026-11-01' } }, ctx))
      .toMatchObject({ ok: false, error: { code: 'repeatUntilInvalid' } });

    const busy = state({ entries: [lesson({ id: 'x', date: '2026-12-04', subject: 'Art' })] });
    expect(saveLesson(busy, { draft: draft({ id: 'a', date: '2026-11-20' }), recurrence: { frequency: 'weekly', until: '2026-12-11' } }, ctx))
      .toEqual({ ok: false, error: { code: 'scheduleConflict', params: { subject: 'Art', date: '2026-12-04' } } });
  });

  describe('editing a series', () => {
    const series = state({
      entries: ['2026-11-13', '2026-11-20', '2026-11-27'].map((date, index) =>
        lesson({ id: `s${index}`, date, seriesId: 'S', notes: index === 2 ? 'keep me' : '' })),
    });

    it('changes only this lesson by default, including its date', () => {
      const result = expectOk(saveLesson(series, { draft: draft({ id: 's1', date: '2026-11-21', subject: 'Moved' }) }, ctx));
      expect(result.state.entries.map((item) => [item.date, item.subject])).toEqual([
        ['2026-11-13', 'Math'], ['2026-11-21', 'Moved'], ['2026-11-27', 'Math'],
      ]);
    });

    it('copies shared fields to following lessons but keeps their dates and notes', () => {
      const result = expectOk(saveLesson(series, {
        draft: draft({ id: 's1', date: '2026-11-20', subject: 'Geometry', startTime: '11:00', endTime: '12:00', notes: 'only here' }),
        scope: 'following',
      }, ctx));
      expect(result.value.count).toBe(2);
      expect(result.state.entries.map((item) => [item.date, item.subject, item.startTime, item.notes])).toEqual([
        ['2026-11-13', 'Math', '09:00', ''],
        ['2026-11-20', 'Geometry', '11:00', 'only here'],
        ['2026-11-27', 'Geometry', '11:00', 'keep me'],
      ]);
    });

    it('deletes this and following lessons as tombstones', () => {
      const result = expectOk(deleteLesson(series, { id: 's1', scope: 'following' }, ctx));
      expect(result.value.count).toBe(2);
      expect(alive(result.state.entries).map((item) => item.id)).toEqual(['s0']);
      expect(deleteLesson(series, { id: 'missing' }, ctx)).toMatchObject({ ok: false, error: { code: 'lessonMissing' } });
    });
  });

  it('marks follow-ups done', () => {
    const result = expectOk(setFollowUpDone(state({ entries: [lesson({ id: 'a', date: '2026-11-13', notes: 'x' })] }), { id: 'a', done: true }, ctx));
    expect(result.state.entries[0]).toMatchObject({ notesDone: true, dirty: true });
  });
});

describe('classes and students', () => {
  it('adds classes, reusing existing names', () => {
    const existing = expectOk(commands.addClass(state(), { name: ' 7b ' }, ctx));
    expect(existing.value.id).toBe('c7b');
    const created = expectOk(commands.addClass(state(), { name: '8A' }, ctx));
    expect(created.state.classes.map((item) => item.name)).toEqual(['7B', '8A']);
    expect(commands.addClass(state(), { name: '' }, ctx)).toMatchObject({ ok: false, error: { code: 'classNameRequired' } });
  });

  it('renames with validation', () => {
    const start = state({ classes: [classOf('c7b', '7B'), classOf('c8a', '8A')] });
    expect(commands.renameClass(start, { id: 'c7b', name: '8a' }, ctx)).toMatchObject({ ok: false, error: { code: 'classNameTaken' } });
    expect(expectOk(commands.renameClass(start, { id: 'c7b', name: '7B Maths' }, ctx)).state.classes[0].name).toBe('7B Maths');
  });

  it('blocks deleting classes with upcoming lessons or templates', () => {
    const start = state({
      entries: [lesson({ id: 'future', date: '2026-12-01' }), lesson({ id: 'past', date: '2026-01-01', classId: 'free' })],
      classes: [classOf('c7b', '7B'), classOf('free', 'Free'), classOf('tpl', 'Tpl')],
      templates: [template({ id: 't', entries: [{ day: 0, startTime: '09:00', endTime: '10:00', subject: 'Art', classId: 'tpl', room: '' }] })],
    });
    expect(commands.deleteClass(start, { id: 'c7b' }, ctx)).toEqual({ ok: false, error: { code: 'classInUse', params: { upcoming: 1, templates: 0 } } });
    expect(commands.deleteClass(start, { id: 'tpl' }, ctx)).toEqual({ ok: false, error: { code: 'classInUse', params: { upcoming: 0, templates: 1 } } });
    expect(expectOk(commands.deleteClass(start, { id: 'free' }, ctx)).state.classes[1].deleted).toBe(true);
  });

  it('adds, edits and removes students', () => {
    const added = expectOk(commands.addStudent(state(), { classId: 'c7b', name: ' Ana ' }, ctx));
    const student = added.value;
    expect(student.name).toBe('Ana');
    expect(commands.addStudent(added.state, { classId: 'c7b', name: 'ana' }, ctx)).toMatchObject({ ok: false, error: { code: 'studentExists' } });

    const edited = expectOk(commands.updateStudent(added.state, {
      classId: 'c7b', studentId: student.id, patch: { notes: ' Nut allergy ', contact: 'Mum: 0612' },
    }, ctx));
    expect(edited.state.classes[0].students[0]).toEqual({ id: student.id, name: 'Ana', notes: 'Nut allergy', contact: 'Mum: 0612' });
    expect(commands.updateStudent(added.state, { classId: 'c7b', studentId: student.id, patch: { name: '' } }, ctx))
      .toMatchObject({ ok: false, error: { code: 'studentNameRequired' } });

    const removed = expectOk(commands.removeStudent(edited.state, { classId: 'c7b', studentId: student.id }, ctx));
    expect(removed.state.classes[0].students).toEqual([]);
  });
});

describe('templates', () => {
  it('saves, applies, renames and deletes', () => {
    const start = state({ entries: [lesson({ id: 'fri', date: '2026-11-13' })] });
    expect(commands.saveWeekAsTemplate(state(), { start: new Date(2026, 10, 13), name: 'A' }, ctx))
      .toMatchObject({ ok: false, error: { code: 'weekEmpty' } });

    const saved = expectOk(commands.saveWeekAsTemplate(start, { start: new Date(2026, 10, 13), name: ' Week A ' }, ctx));
    expect(saved.value.name).toBe('Week A');
    const applied = expectOk(commands.applyTemplate(saved.state, { templateId: saved.value.id, start: new Date(2026, 10, 20) }, ctx));
    expect(alive(applied.state.entries).map((item) => item.date)).toEqual(['2026-11-13', '2026-11-20']);

    const renamed = expectOk(commands.renameTemplate(applied.state, { id: saved.value.id, name: 'B' }, ctx));
    expect(renamed.state.templates[0].name).toBe('B');
    const deleted = expectOk(commands.deleteTemplate(renamed.state, { id: saved.value.id }, ctx));
    expect(commands.applyTemplate(deleted.state, { templateId: saved.value.id, start: new Date() }, ctx))
      .toMatchObject({ ok: false, error: { code: 'templateMissing' } });
  });
});

describe('assessments', () => {
  const base = { id: 'q', classId: 'c7b', title: 'Quiz 1', date: '2026-11-13', maxScore: 20, scores: {} };

  it('creates and updates assessments, keeping scores', () => {
    const created = expectOk(commands.saveAssessment(state(), base, ctx));
    const scored = expectOk(commands.setScore(created.state, { assessmentId: 'q', studentId: 's1', score: 18 }, ctx));
    const renamed = expectOk(commands.saveAssessment(scored.state, { ...base, title: 'Quiz one', scores: {} }, ctx));
    expect(renamed.state.assessments).toEqual([expect.objectContaining({ title: 'Quiz one', scores: { s1: 18 } })]);
  });

  it.each([
    [{ ...base, title: '' }, 'assessmentTitleRequired'],
    [{ ...base, maxScore: 0 }, 'assessmentMaxInvalid'],
    [{ ...base, classId: 'nope' }, 'classMissing'],
    [{ ...base, date: 'soon' }, 'dateInvalid'],
  ])('validates assessments (%#)', (input, code) => {
    expect(commands.saveAssessment(state(), input, ctx)).toMatchObject({ ok: false, error: { code } });
  });

  it('validates and clears scores', () => {
    const start = state({ assessments: [assessment({ id: 'q', scores: { s1: 10 } })] });
    expect(commands.setScore(start, { assessmentId: 'q', studentId: 's1', score: 21 }, ctx))
      .toEqual({ ok: false, error: { code: 'scoreOutOfRange', params: { max: 20 } } });
    expect(commands.setScore(start, { assessmentId: 'q', studentId: 's1', score: -1 }, ctx)).toMatchObject({ ok: false });
    expect(expectOk(commands.setScore(start, { assessmentId: 'q', studentId: 's1', score: null }, ctx)).state.assessments[0].scores).toEqual({});
    // Lowering the maximum below an existing score is rejected.
    expect(commands.saveAssessment(start, { ...base, maxScore: 5, scores: {} }, ctx)).toMatchObject({ ok: false, error: { code: 'scoreOutOfRange' } });
    expect(expectOk(commands.deleteAssessment(start, { id: 'q' }, ctx)).state.assessments[0].deleted).toBe(true);
  });
});

describe('calendar', () => {
  it('saves and deletes events with validation', () => {
    const event = { id: 'h', title: ' Winter break ', kind: 'holiday' as const, startDate: '2026-12-20', endDate: '2027-01-03' };
    const saved = expectOk(commands.saveEvent(state(), event, ctx));
    expect(saved.value.title).toBe('Winter break');
    expect(commands.saveEvent(state(), { ...event, endDate: '2026-12-01' }, ctx)).toMatchObject({ ok: false, error: { code: 'eventDatesInvalid' } });
    expect(commands.saveEvent(state(), { ...event, title: '' }, ctx)).toMatchObject({ ok: false, error: { code: 'eventTitleRequired' } });
    expect(expectOk(commands.deleteEvent(saved.state, { id: 'h' }, ctx)).state.events[0].deleted).toBe(true);
  });

  it('configures Week A/B rotation', () => {
    expect(commands.setRotation(state(), { enabled: true, anchorWeek: null }, ctx)).toMatchObject({ ok: false, error: { code: 'rotationAnchorRequired' } });
    const on = expectOk(commands.setRotation(state(), { enabled: true, anchorWeek: '2026-11-13' }, ctx));
    expect(on.state.settings).toEqual([expect.objectContaining({ id: 'calendar', dirty: true, rotation: { enabled: true, anchorWeek: '2026-11-13' } })]);
    const off = expectOk(commands.setRotation(on.state, { enabled: false, anchorWeek: null }, ctx));
    expect(off.state.settings).toHaveLength(1);
    expect(off.state.settings[0].rotation).toEqual({ enabled: false, anchorWeek: '2026-11-13' });
  });
});
