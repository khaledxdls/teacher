import { commands, normalizeUrl } from '../commands';
import { alive } from '../records';
import { emptyPlannerState } from '../types';
import {
  assessment,
  attendanceMark,
  classOf,
  ctx,
  draft,
  expectOk,
  holiday,
  lesson,
  NOW,
  score,
  state,
  student,
  template,
} from '../../test-utils/domainFixtures';

const { saveLesson, deleteLesson } = commands;

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

  it('creates a repeating series that skips holidays and keeps notes and plan on the first lesson only', () => {
    const start = state({ events: [holiday('h', '2026-11-27')] });
    const result = expectOk(saveLesson(start, {
      draft: draft({ id: 'first', date: '2026-11-20', notes: 'Bring rulers', plan: { objectives: 'Angles' } }),
      recurrence: { frequency: 'weekly', until: '2026-12-11' },
    }, ctx));

    expect(result.value.count).toBe(3);
    const [first, ...rest] = result.state.entries;
    expect(result.state.entries.map((item) => item.date)).toEqual(['2026-11-20', '2026-12-04', '2026-12-11']);
    expect(new Set(result.state.entries.map((item) => item.seriesId)).size).toBe(1);
    expect(first).toMatchObject({ id: 'first', notes: 'Bring rulers', plan: { objectives: 'Angles' } });
    expect(rest.every((item) => item.notes === '' && item.plan === undefined)).toBe(true);
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

  it('updates notes and follow-up status', () => {
    const start = state({ entries: [lesson({ id: 'a', date: '2026-11-13' })] });
    const noted = expectOk(commands.updateLessonNotes(start, { id: 'a', notes: '  Call parents ', notesDone: false }, ctx));
    expect(noted.state.entries[0]).toMatchObject({ notes: 'Call parents', notesDone: false, dirty: true });
    const doneResult = expectOk(commands.setFollowUpDone(noted.state, { id: 'a', done: true }, ctx));
    expect(doneResult.state.entries[0].notesDone).toBe(true);
  });
});

describe('lesson plans', () => {
  const start = state({ entries: [lesson({ id: 'a', date: '2026-11-13' })] });

  it.each([
    ['https://example.com/x', 'https://example.com/x'],
    ['docs.google.com/doc/1', 'https://docs.google.com/doc/1'],
    ['http://site.org', 'http://site.org'],
    ['not a link', null],
    ['ftp://files.example.com', null],
    ['localhost', null],
  ])('normalizes "%s"', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  it('saves objectives, links and homework, dropping empty rows', () => {
    const result = expectOk(commands.saveLessonPlan(start, {
      lessonId: 'a',
      plan: {
        objectives: ' Fractions ',
        resources: [{ id: '', label: '', url: 'khanacademy.org/fractions' }, { id: 'r2', label: ' ', url: ' ' }],
        homework: ' Page 12 ',
        homeworkDue: '2026-11-20',
      },
    }, ctx));
    expect(result.state.entries[0].plan).toEqual({
      objectives: 'Fractions',
      resources: [{ id: expect.any(String), label: 'https://khanacademy.org/fractions', url: 'https://khanacademy.org/fractions' }],
      homework: 'Page 12',
      homeworkDue: '2026-11-20',
    });
  });

  it('rejects invalid links and clears an empty plan', () => {
    expect(commands.saveLessonPlan(start, { lessonId: 'a', plan: { resources: [{ id: 'r', label: 'Slides', url: 'nope' }] } }, ctx))
      .toEqual({ ok: false, error: { code: 'linkInvalid', params: { link: 'nope' } } });
    const withPlan = state({ entries: [lesson({ id: 'a', date: '2026-11-13', plan: { objectives: 'x' } })] });
    expect(expectOk(commands.saveLessonPlan(withPlan, { lessonId: 'a', plan: { objectives: ' ' } }, ctx)).state.entries[0].plan).toBeUndefined();
  });
});

describe('attendance and homework marks', () => {
  const start = state({
    entries: [lesson({ id: 'l1', date: '2026-11-13' })],
    students: [student('ana', 'Ana'), student('ben', 'Ben'), student('other', 'Other', 'c8a'), student('gone', 'Gone', 'c7b', { deleted: true })],
  });

  it('sets, changes and clears one mark per lesson and student', () => {
    const set = expectOk(commands.setAttendance(start, { lessonId: 'l1', studentId: 'ana', status: 'late' }, ctx));
    expect(set.state.attendance).toEqual([{ id: 'l1:ana', lessonId: 'l1', studentId: 'ana', status: 'late', updatedAt: NOW, dirty: true }]);
    const changed = expectOk(commands.setAttendance(set.state, { lessonId: 'l1', studentId: 'ana', status: 'present' }, ctx));
    expect(changed.state.attendance).toHaveLength(1);
    expect(changed.state.attendance[0].status).toBe('present');
    const cleared = expectOk(commands.setAttendance(changed.state, { lessonId: 'l1', studentId: 'ana', status: null }, ctx));
    expect(cleared.state.attendance[0].deleted).toBe(true);
    // Setting it again revives the same record.
    const revived = expectOk(commands.setAttendance(cleared.state, { lessonId: 'l1', studentId: 'ana', status: 'absent' }, ctx));
    expect(revived.state.attendance).toEqual([expect.objectContaining({ id: 'l1:ana', status: 'absent' })]);
    expect(revived.state.attendance[0].deleted).toBeUndefined();
  });

  it('marks every current student of the class present', () => {
    const result = expectOk(commands.markAllPresent({ ...start, attendance: [attendanceMark('l1', 'ana', 'late')] }, { lessonId: 'l1' }, ctx));
    expect(result.state.attendance.map((mark) => [mark.id, mark.status])).toEqual([['l1:ana', 'present'], ['l1:ben', 'present']]);
  });

  it('tracks homework per student and validates ids', () => {
    const result = expectOk(commands.setHomework(start, { lessonId: 'l1', studentId: 'ben', status: 'missing' }, ctx));
    expect(result.state.homework).toEqual([expect.objectContaining({ id: 'l1:ben', status: 'missing' })]);
    expect(commands.setHomework(start, { lessonId: 'nope', studentId: 'ben', status: 'done' }, ctx)).toMatchObject({ ok: false, error: { code: 'lessonMissing' } });
    expect(commands.setAttendance(start, { lessonId: 'l1', studentId: 'gone', status: 'present' }, ctx)).toMatchObject({ ok: false, error: { code: 'studentMissing' } });
  });
});

describe('classes and students', () => {
  it('adds classes, reusing existing names', () => {
    expect(expectOk(commands.addClass(state(), { name: ' 7b ' }, ctx)).value.id).toBe('c7b');
    const created = expectOk(commands.addClass(state(), { name: '8A' }, ctx));
    expect(created.state.classes.map((item) => item.name)).toEqual(['7B', '8A']);
    expect(commands.addClass(state(), { name: '' }, ctx)).toMatchObject({ ok: false, error: { code: 'classNameRequired' } });
  });

  it('renames with validation', () => {
    const start = state({ classes: [classOf('c7b', '7B'), classOf('c8a', '8A')] });
    expect(commands.renameClass(start, { id: 'c7b', name: '8a' }, ctx)).toMatchObject({ ok: false, error: { code: 'classNameTaken' } });
    expect(expectOk(commands.renameClass(start, { id: 'c7b', name: '7B Maths' }, ctx)).state.classes[0].name).toBe('7B Maths');
  });

  it('blocks deleting classes in use, and deletes students with the class', () => {
    const start = state({
      entries: [lesson({ id: 'future', date: '2026-12-01' }), lesson({ id: 'past', date: '2026-01-01', classId: 'free' })],
      classes: [classOf('c7b', '7B'), classOf('free', 'Free'), classOf('tpl', 'Tpl')],
      students: [student('ana', 'Ana', 'free'), student('ben', 'Ben', 'c7b')],
      templates: [template({ id: 't', entries: [{ day: 0, startTime: '09:00', endTime: '10:00', subject: 'Art', classId: 'tpl', room: '' }] })],
    });
    expect(commands.deleteClass(start, { id: 'c7b' }, ctx)).toEqual({ ok: false, error: { code: 'classInUse', params: { upcoming: 1, templates: 0 } } });
    expect(commands.deleteClass(start, { id: 'tpl' }, ctx)).toEqual({ ok: false, error: { code: 'classInUse', params: { upcoming: 0, templates: 1 } } });
    const deleted = expectOk(commands.deleteClass(start, { id: 'free' }, ctx));
    expect(deleted.state.classes[1].deleted).toBe(true);
    expect(alive(deleted.state.students).map((item) => item.id)).toEqual(['ben']);
  });

  it('adds, edits and removes students as separate records', () => {
    const added = expectOk(commands.addStudent(state(), { classId: 'c7b', name: ' Ana ' }, ctx));
    expect(added.value).toMatchObject({ classId: 'c7b', name: 'Ana', dirty: true });
    expect(commands.addStudent(added.state, { classId: 'c7b', name: 'ana' }, ctx)).toMatchObject({ ok: false, error: { code: 'studentExists' } });
    // The same name is fine in another class.
    expect(commands.addStudent({ ...added.state, classes: [...added.state.classes, classOf('c8a', '8A')] }, { classId: 'c8a', name: 'Ana' }, ctx).ok).toBe(true);

    const edited = expectOk(commands.updateStudent(added.state, { studentId: added.value.id, patch: { notes: ' Nut allergy ', contact: 'Mum: 0612' } }, ctx));
    expect(edited.state.students[0]).toMatchObject({ name: 'Ana', notes: 'Nut allergy', contact: 'Mum: 0612' });
    expect(commands.updateStudent(added.state, { studentId: added.value.id, patch: { name: '' } }, ctx))
      .toMatchObject({ ok: false, error: { code: 'studentNameRequired' } });

    const removed = expectOk(commands.removeStudent(edited.state, { studentId: added.value.id }, ctx));
    expect(alive(removed.state.students)).toEqual([]);
  });
});

describe('behavior notes', () => {
  it('adds notes linked to the student and class, and deletes them', () => {
    const start = state({ students: [student('ana', 'Ana')] });
    const added = expectOk(commands.addBehaviorNote(start, { studentId: 'ana', kind: 'positive', date: '2026-11-13', lessonId: 'l1', note: ' Great answer ' }, ctx));
    expect(added.value).toMatchObject({ studentId: 'ana', classId: 'c7b', lessonId: 'l1', kind: 'positive', note: 'Great answer' });
    expect(commands.addBehaviorNote(start, { studentId: 'nobody', kind: 'negative', date: '2026-11-13' }, ctx)).toMatchObject({ ok: false });
    expect(expectOk(commands.deleteBehaviorNote(added.state, { id: added.value.id }, ctx)).state.behavior[0].deleted).toBe(true);
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
    const deleted = expectOk(commands.deleteTemplate(renamed.state, { id: saved.value.id }, ctx));
    expect(commands.applyTemplate(deleted.state, { templateId: saved.value.id, start: new Date() }, ctx))
      .toMatchObject({ ok: false, error: { code: 'templateMissing' } });
  });
});

describe('assessments and scores', () => {
  const base = { id: 'q', classId: 'c7b', title: 'Quiz 1', date: '2026-11-13', maxScore: 20 };

  it('creates and updates assessments; scores are separate records', () => {
    const created = expectOk(commands.saveAssessment(state(), base, ctx));
    const scored = expectOk(commands.setScore(created.state, { assessmentId: 'q', studentId: 's1', score: 18 }, ctx));
    expect(scored.state.scores).toEqual([expect.objectContaining({ id: 'q:s1', assessmentId: 'q', studentId: 's1', value: 18 })]);
    const renamed = expectOk(commands.saveAssessment(scored.state, { ...base, title: 'Quiz one' }, ctx));
    expect(renamed.state.assessments).toEqual([expect.objectContaining({ title: 'Quiz one' })]);
    expect(renamed.state.scores).toHaveLength(1);
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
    const start = state({ assessments: [assessment({ id: 'q' })], scores: [score('q', 's1', 10)] });
    expect(commands.setScore(start, { assessmentId: 'q', studentId: 's1', score: 21 }, ctx))
      .toEqual({ ok: false, error: { code: 'scoreOutOfRange', params: { max: 20 } } });
    expect(commands.setScore(start, { assessmentId: 'q', studentId: 's1', score: -1 }, ctx)).toMatchObject({ ok: false });
    expect(expectOk(commands.setScore(start, { assessmentId: 'q', studentId: 's1', score: null }, ctx)).state.scores[0].deleted).toBe(true);
    expect(commands.saveAssessment(start, { ...base, maxScore: 5 }, ctx)).toMatchObject({ ok: false, error: { code: 'scoreOutOfRange' } });
    expect(expectOk(commands.deleteAssessment(start, { id: 'q' }, ctx)).state.assessments[0].deleted).toBe(true);
  });
});

describe('calendar', () => {
  it('saves and deletes events with validation', () => {
    const event = { id: 'h', title: ' Winter break ', kind: 'holiday' as const, startDate: '2026-12-20', endDate: '2027-01-03' };
    const saved = expectOk(commands.saveEvent(state(), event, ctx));
    expect(saved.value.title).toBe('Winter break');
    expect(commands.saveEvent(state(), { ...event, endDate: '2026-12-01' }, ctx)).toMatchObject({ ok: false, error: { code: 'eventDatesInvalid' } });
    expect(expectOk(commands.deleteEvent(saved.state, { id: 'h' }, ctx)).state.events[0].deleted).toBe(true);
  });

  it('configures Week A/B rotation', () => {
    expect(commands.setRotation(state(), { enabled: true, anchorWeek: null }, ctx)).toMatchObject({ ok: false, error: { code: 'rotationAnchorRequired' } });
    const on = expectOk(commands.setRotation(state(), { enabled: true, anchorWeek: '2026-11-13' }, ctx));
    expect(on.state.settings).toEqual([expect.objectContaining({ id: 'calendar', rotation: { enabled: true, anchorWeek: '2026-11-13' } })]);
  });
});

describe('importBackup', () => {
  it('merges and reports what changed', () => {
    const incoming = { ...emptyPlannerState, classes: [classOf('new', 'New')] };
    const result = expectOk(commands.importBackup(state(), { data: incoming }, ctx));
    expect(result.value).toEqual({ added: 1, updated: 0 });
    expect(result.state.classes.map((item) => item.id)).toEqual(['c7b', 'new']);
  });
});
