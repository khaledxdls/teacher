import { fail } from '../errors';
import { alive, createId, findLive, removeById, sameName, tombstone, touch, updateById } from '../records';
import { PlannerState, SavedClass, Student } from '../types';
import { CommandContext, CommandResult, done } from './types';

const liveClassNamed = (state: PlannerState, name: string, exceptId?: string) =>
  alive(state.classes).find((item) => item.id !== exceptId && sameName(item.name, name));

const liveStudentsOf = (state: PlannerState, classId: string) =>
  alive(state.students).filter((student) => student.classId === classId);

/** Returns the class with this name, creating it if needed. */
export function addClass(state: PlannerState, input: { name: string }, ctx: CommandContext): CommandResult<SavedClass> {
  const name = input.name.trim();
  if (!name) return fail('classNameRequired');
  const existing = liveClassNamed(state, name);
  if (existing) return done(state, existing);
  const created = touch<SavedClass>({ id: createId(), name, updatedAt: 0 }, ctx.now);
  return done({ ...state, classes: [...state.classes, created] }, created);
}

export function renameClass(state: PlannerState, input: { id: string; name: string }, ctx: CommandContext): CommandResult {
  const name = input.name.trim();
  if (!name) return fail('classNameRequired');
  if (!findLive(state.classes, input.id)) return fail('classMissing');
  if (liveClassNamed(state, name, input.id)) return fail('classNameTaken');
  return done({ ...state, classes: updateById(state.classes, input.id, (item) => ({ ...item, name }), ctx.now) });
}

/**
 * Deleting is blocked while upcoming lessons or templates still use the class; past lessons
 * keep its name. The class's students are deleted with it.
 */
export function deleteClass(state: PlannerState, input: { id: string }, ctx: CommandContext): CommandResult {
  if (!findLive(state.classes, input.id)) return fail('classMissing');
  const upcoming = alive(state.entries).filter((entry) => entry.classId === input.id && entry.date >= ctx.today).length;
  const templates = alive(state.templates).filter((template) => template.entries.some((entry) => entry.classId === input.id)).length;
  if (upcoming || templates) return fail('classInUse', { upcoming, templates });
  const studentIds = new Set(liveStudentsOf(state, input.id).map((student) => student.id));
  return done({
    ...state,
    classes: removeById(state.classes, input.id, ctx.now),
    students: state.students.map((student) => (studentIds.has(student.id) ? tombstone(student, ctx.now) : student)),
  });
}

function validateStudentName(state: PlannerState, classId: string, name: string, exceptId?: string) {
  if (!name) return fail('studentNameRequired');
  if (liveStudentsOf(state, classId).some((student) => student.id !== exceptId && sameName(student.name, name))) return fail('studentExists');
  return null;
}

export function addStudent(state: PlannerState, input: { classId: string; name: string }, ctx: CommandContext): CommandResult<Student> {
  if (!findLive(state.classes, input.classId)) return fail('classMissing');
  const name = input.name.trim();
  const invalid = validateStudentName(state, input.classId, name);
  if (invalid) return invalid;
  const student = touch<Student>({ id: createId(), classId: input.classId, name, updatedAt: 0 }, ctx.now);
  return done({ ...state, students: [...state.students, student] }, student);
}

export type StudentPatch = Partial<Pick<Student, 'name' | 'notes' | 'contact'>>;

export function updateStudent(state: PlannerState, input: { studentId: string; patch: StudentPatch }, ctx: CommandContext): CommandResult {
  const student = findLive(state.students, input.studentId);
  if (!student) return fail('studentMissing');
  const patch: StudentPatch = Object.fromEntries(Object.entries(input.patch).map(([key, value]) => [key, value?.trim()]));
  if (patch.name !== undefined) {
    const invalid = validateStudentName(state, student.classId, patch.name, student.id);
    if (invalid) return invalid;
  }
  return done({ ...state, students: updateById(state.students, student.id, (item) => ({ ...item, ...patch }), ctx.now) });
}

/** Removes a student from their class. Their past attendance, scores and notes are kept for history. */
export function removeStudent(state: PlannerState, input: { studentId: string }, ctx: CommandContext): CommandResult {
  if (!findLive(state.students, input.studentId)) return fail('studentMissing');
  return done({ ...state, students: removeById(state.students, input.studentId, ctx.now) });
}
