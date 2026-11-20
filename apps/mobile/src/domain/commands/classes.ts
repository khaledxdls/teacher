import { fail } from '../errors';
import { alive, createId, findLive, removeById, sameName, touch, updateById } from '../records';
import { PlannerState, SavedClass, Student } from '../types';
import { CommandContext, CommandResult, done } from './types';

const liveClassNamed = (state: PlannerState, name: string, exceptId?: string) =>
  alive(state.classes).find((item) => item.id !== exceptId && sameName(item.name, name));

/** Returns the class with this name, creating it if needed. */
export function addClass(state: PlannerState, input: { name: string }, ctx: CommandContext): CommandResult<SavedClass> {
  const name = input.name.trim();
  if (!name) return fail('classNameRequired');
  const existing = liveClassNamed(state, name);
  if (existing) return done(state, existing);
  const created = touch<SavedClass>({ id: createId(), name, students: [], updatedAt: 0 }, ctx.now);
  return done({ ...state, classes: [...state.classes, created] }, created);
}

export function renameClass(state: PlannerState, input: { id: string; name: string }, ctx: CommandContext): CommandResult {
  const name = input.name.trim();
  if (!name) return fail('classNameRequired');
  if (!findLive(state.classes, input.id)) return fail('classMissing');
  if (liveClassNamed(state, name, input.id)) return fail('classNameTaken');
  return done({ ...state, classes: updateById(state.classes, input.id, (item) => ({ ...item, name }), ctx.now) });
}

/** Deleting is blocked while upcoming lessons or templates still use the class; past lessons keep its name. */
export function deleteClass(state: PlannerState, input: { id: string }, ctx: CommandContext): CommandResult {
  if (!findLive(state.classes, input.id)) return fail('classMissing');
  const upcoming = alive(state.entries).filter((entry) => entry.classId === input.id && entry.date >= ctx.today).length;
  const templates = alive(state.templates).filter((template) => template.entries.some((entry) => entry.classId === input.id)).length;
  if (upcoming || templates) return fail('classInUse', { upcoming, templates });
  return done({ ...state, classes: removeById(state.classes, input.id, ctx.now) });
}

function validateStudentName(savedClass: SavedClass, name: string, exceptId?: string) {
  if (!name) return fail('studentNameRequired');
  if (savedClass.students.some((student) => student.id !== exceptId && sameName(student.name, name))) return fail('studentExists');
  return null;
}

export function addStudent(state: PlannerState, input: { classId: string; name: string }, ctx: CommandContext): CommandResult<Student> {
  const savedClass = findLive(state.classes, input.classId);
  if (!savedClass) return fail('classMissing');
  const name = input.name.trim();
  const invalid = validateStudentName(savedClass, name);
  if (invalid) return invalid;
  const student: Student = { id: createId(), name };
  const classes = updateById(state.classes, savedClass.id, (item) => ({ ...item, students: [...item.students, student] }), ctx.now);
  return done({ ...state, classes }, student);
}

export type StudentPatch = Partial<Pick<Student, 'name' | 'notes' | 'contact'>>;

export function updateStudent(state: PlannerState, input: { classId: string; studentId: string; patch: StudentPatch }, ctx: CommandContext): CommandResult {
  const savedClass = findLive(state.classes, input.classId);
  if (!savedClass || !savedClass.students.some((student) => student.id === input.studentId)) return fail('classMissing');
  const patch: StudentPatch = Object.fromEntries(Object.entries(input.patch).map(([key, value]) => [key, value?.trim()]));
  if (patch.name !== undefined) {
    const invalid = validateStudentName(savedClass, patch.name, input.studentId);
    if (invalid) return invalid;
  }
  const classes = updateById(state.classes, savedClass.id, (item) => ({
    ...item,
    students: item.students.map((student) => (student.id === input.studentId ? { ...student, ...patch } : student)),
  }), ctx.now);
  return done({ ...state, classes });
}

export function removeStudent(state: PlannerState, input: { classId: string; studentId: string }, ctx: CommandContext): CommandResult {
  if (!findLive(state.classes, input.classId)) return fail('classMissing');
  const classes = updateById(state.classes, input.classId, (item) => ({
    ...item, students: item.students.filter((student) => student.id !== input.studentId),
  }), ctx.now);
  return done({ ...state, classes });
}
