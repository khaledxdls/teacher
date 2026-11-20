import { useMemo } from 'react';
import { calendarSettingsOf, sortEvents } from '../domain/calendar';
import { sortAssessments } from '../domain/grades';
import { alive, indexById } from '../domain/records';
import { countDirty } from '../domain/sync';
import { PlannerState } from '../domain/types';
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
