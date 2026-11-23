import { useMemo } from 'react';
import { indexAttendance } from '../domain/attendance';
import { calendarSettingsOf, sortEvents } from '../domain/calendar';
import { indexScores, sortAssessments } from '../domain/grades';
import { indexHomework } from '../domain/homework';
import { alive, groupBy, indexById } from '../domain/records';
import { countDirty } from '../domain/sync';
import { PlannerState, Student } from '../domain/types';
import { usePlannerContext } from './PlannerProvider';
import { useStoreSelector } from './store';

/** Subscribes to one slice of planner state. */
export function usePlannerSelector<S>(selector: (state: PlannerState) => S) {
  return useStoreSelector(usePlannerContext().store, selector);
}

export const usePlannerActions = () => usePlannerContext().actions;
export const usePlannerHydrated = () => usePlannerContext().hydrated;
export const usePlannerStore = () => usePlannerContext().store;

/** Live (non-deleted) lessons. */
export function useLessons() {
  const entries = usePlannerSelector((state) => state.entries);
  return useMemo(() => alive(entries), [entries]);
}

/** Live classes, sorted by name. */
export function useClasses() {
  const classes = usePlannerSelector((state) => state.classes);
  return useMemo(() => alive(classes).sort((a, b) => a.name.localeCompare(b.name)), [classes]);
}

/** All classes by id, including deleted ones, so past lessons can still show their class name. */
export function useClassById() {
  const classes = usePlannerSelector((state) => state.classes);
  return useMemo(() => indexById(classes), [classes]);
}

const NO_STUDENTS: Student[] = [];
const byName = (a: Student, b: Student) => a.name.localeCompare(b.name);

/** Live students grouped by class id, each list sorted by name. */
export function useStudentsByClass() {
  const students = usePlannerSelector((state) => state.students);
  return useMemo(() => {
    const groups = groupBy(students, (student) => student.classId);
    for (const list of groups.values()) list.sort(byName);
    return groups;
  }, [students]);
}

/** Live students of one class, sorted by name. */
export function useStudents(classId: string | undefined) {
  const groups = useStudentsByClass();
  return (classId && groups.get(classId)) || NO_STUDENTS;
}

/** All students by id (including removed ones, for history). */
export function useStudentById() {
  const students = usePlannerSelector((state) => state.students);
  return useMemo(() => indexById(students), [students]);
}

export function useTemplates() {
  const templates = usePlannerSelector((state) => state.templates);
  return useMemo(() => alive(templates), [templates]);
}

/** Live assessments of a class, newest first. */
export function useAssessments(classId: string | undefined) {
  const assessments = usePlannerSelector((state) => state.assessments);
  return useMemo(
    () => sortAssessments(alive(assessments).filter((assessment) => assessment.classId === classId)),
    [assessments, classId],
  );
}

/** Scores indexed by assessment, then student. */
export function useScoreIndex() {
  const scores = usePlannerSelector((state) => state.scores);
  return useMemo(() => indexScores(scores), [scores]);
}

/** Attendance statuses indexed by lesson, then student. */
export function useAttendanceIndex() {
  const attendance = usePlannerSelector((state) => state.attendance);
  return useMemo(() => indexAttendance(attendance), [attendance]);
}

/** Homework statuses indexed by lesson, then student. */
export function useHomeworkIndex() {
  const homework = usePlannerSelector((state) => state.homework);
  return useMemo(() => indexHomework(homework), [homework]);
}

/** Live behaviour notes. */
export function useBehaviorNotes() {
  const behavior = usePlannerSelector((state) => state.behavior);
  return useMemo(() => alive(behavior), [behavior]);
}

export function useCalendar() {
  const events = usePlannerSelector((state) => state.events);
  const settings = usePlannerSelector((state) => state.settings);
  return useMemo(() => ({
    events: sortEvents(alive(events)),
    settings: calendarSettingsOf(settings),
  }), [events, settings]);
}

const dirtyCounts = new WeakMap<PlannerState, number>();
const cachedCountDirty = (state: PlannerState) => {
  let count = dirtyCounts.get(state);
  if (count === undefined) {
    count = countDirty(state);
    dirtyCounts.set(state, count);
  }
  return count;
};

/** Number of local changes not yet uploaded. */
export const usePendingChanges = () => usePlannerSelector(cachedCountDirty);
