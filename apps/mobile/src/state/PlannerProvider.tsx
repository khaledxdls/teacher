import { createContext, ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  alive,
  applyTemplateToWeek,
  createId,
  createWeekTemplate,
  dateKey,
  emptyPlannerState,
  EntryDraft,
  entriesInWeek,
  findScheduleConflict,
  PlannerState,
  sameName,
  SavedClass,
  ScheduleEntry,
  ScheduleTemplate,
  tombstone,
  touch,
} from '../domain/schedule';
import { collectDirty } from '../domain/sync';
import { ClassReminder, requestNotificationPermission, scheduleClassReminders, scheduleWeeklyReminder } from '../services/notifications';
import { loadPlannerState, loadWeeklyReminder, saveClasses, saveEntries, saveTemplates, saveWeeklyReminder } from '../services/storage';

const warn = (label: string) => (error: unknown) => console.warn(label, error);

/** Error message to show the user, or `null` when the action succeeded. */
export type ActionError = string | null;

export type PlannerContextValue = {
  hydrated: boolean;
  /** Live (non-deleted) records. */
  entries: ScheduleEntry[];
  classes: SavedClass[];
  templates: ScheduleTemplate[];
  /** Includes deleted classes so past entries can still show their class name. */
  classById: Map<string, SavedClass>;
  /** Number of local changes not yet uploaded. */
  pendingChanges: number;
  weeklyReminder: boolean;
  setWeeklyReminder: (enabled: boolean) => void;

  saveEntry: (draft: EntryDraft) => ActionError;
  deleteEntry: (id: string) => void;

  addClass: (name: string) => SavedClass;
  renameClass: (id: string, name: string) => ActionError;
  deleteClass: (id: string) => ActionError;
  addStudent: (classId: string, name: string) => ActionError;
  removeStudent: (classId: string, studentId: string) => void;

  saveWeekAsTemplate: (start: Date, name: string) => ActionError;
  applyTemplate: (templateId: string, start: Date) => ActionError;
  renameTemplate: (id: string, name: string) => ActionError;
  deleteTemplate: (id: string) => void;

  /** Sync plumbing: read the full state (including tombstones) and replace it atomically. */
  getState: () => PlannerState;
  updateState: (update: (state: PlannerState) => PlannerState) => void;
};

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function usePlanner() {
  const value = useContext(PlannerContext);
  if (!value) throw new Error('usePlanner must be used inside <PlannerProvider>');
  return value;
}

/**
 * Owns all persisted planner state: loads it once, then saves and reschedules
 * notifications whenever it changes. Nothing is written until loading has finished,
 * so the initial empty state can never overwrite stored data.
 */
export function PlannerProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<PlannerState>(emptyPlannerState);
  const [weeklyReminder, setWeeklyReminder] = useState(true);
  const stateRef = useRef(state);
  // Layout effects run before any passive effect, so children's effects (e.g. sync) read fresh state.
  useLayoutEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    let active = true;
    Promise.all([loadPlannerState(), loadWeeklyReminder()])
      .then(([loaded, reminder]) => {
        if (!active) return;
        setState(loaded);
        setWeeklyReminder(reminder);
        setHydrated(true);
      })
      // Stay un-hydrated on failure so the empty in-memory state never overwrites stored data.
      .catch(warn('Failed to load planner data'));
    requestNotificationPermission().catch(warn('Notification permission request failed'));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (hydrated) saveEntries(state.entries).catch(warn('Failed to save entries'));
  }, [hydrated, state.entries]);
  useEffect(() => {
    if (hydrated) saveClasses(state.classes).catch(warn('Failed to save classes'));
  }, [hydrated, state.classes]);
  useEffect(() => {
    if (hydrated) saveTemplates(state.templates).catch(warn('Failed to save templates'));
  }, [hydrated, state.templates]);

  const classById = useMemo(() => new Map(state.classes.map((item) => [item.id, item])), [state.classes]);
  const entries = useMemo(() => alive(state.entries), [state.entries]);
  const classes = useMemo(() => alive(state.classes).sort((a, b) => a.name.localeCompare(b.name)), [state.classes]);
  const templates = useMemo(() => alive(state.templates), [state.templates]);
  const pendingChanges = useMemo(() => collectDirty(state).length, [state]);

  useEffect(() => {
    if (!hydrated) return;
    const reminders: ClassReminder[] = entries.map((entry) => ({
      ...entry, className: classById.get(entry.classId)?.name ?? '',
    }));
    scheduleClassReminders(reminders).catch(warn('Failed to schedule class reminders'));
  }, [hydrated, entries, classById]);

  useEffect(() => {
    if (!hydrated) return;
    saveWeeklyReminder(weeklyReminder).catch(warn('Failed to save reminder setting'));
    scheduleWeeklyReminder(weeklyReminder).catch(warn('Failed to schedule weekly reminder'));
  }, [hydrated, weeklyReminder]);

  const updateList = useCallback(<K extends keyof PlannerState>(key: K, update: (items: PlannerState[K]) => PlannerState[K]) => {
    setState((current) => ({ ...current, [key]: update(current[key]) }));
  }, []);

  const updateClass = useCallback((id: string, update: (item: SavedClass) => SavedClass) => {
    const now = Date.now();
    updateList('classes', (items) => items.map((item) => (item.id === id ? touch(update(item), now) : item)));
  }, [updateList]);

  const value = useMemo<PlannerContextValue>(() => {
    const findLiveClassByName = (name: string, exceptId?: string) =>
      classes.find((item) => item.id !== exceptId && sameName(item.name, name));

    return {
      hydrated,
      entries,
      classes,
      templates,
      classById,
      pendingChanges,
      weeklyReminder,
      setWeeklyReminder,

      saveEntry(draft) {
        const conflict = findScheduleConflict(draft, entries);
        if (conflict) return `${conflict.subject} is already scheduled at this time.`;
        const now = Date.now();
        updateList('entries', (items) => {
          const record = touch({ ...draft, updatedAt: now }, now);
          return items.some((item) => item.id === draft.id)
            ? items.map((item) => (item.id === draft.id ? record : item))
            : [...items, record];
        });
        return null;
      },

      deleteEntry(id) {
        const now = Date.now();
        updateList('entries', (items) => items.map((item) => (item.id === id ? tombstone(item, now) : item)));
      },

      addClass(name) {
        const existing = findLiveClassByName(name);
        if (existing) return existing;
        const created: SavedClass = touch({ id: createId(), name: name.trim(), students: [], updatedAt: 0 }, Date.now());
        updateList('classes', (items) => [...items, created]);
        return created;
      },

      renameClass(id, name) {
        const trimmed = name.trim();
        if (!trimmed) return 'Enter a class name first.';
        if (findLiveClassByName(trimmed, id)) return 'Another class already has this name.';
        updateClass(id, (item) => ({ ...item, name: trimmed }));
        return null;
      },

      deleteClass(id) {
        const today = dateKey(new Date());
        const upcoming = entries.filter((entry) => entry.classId === id && entry.date >= today).length;
        const inTemplates = templates.filter((template) => template.entries.some((entry) => entry.classId === id)).length;
        if (upcoming || inTemplates) {
          const parts = [
            upcoming ? `${upcoming} upcoming class${upcoming === 1 ? '' : 'es'}` : '',
            inTemplates ? `${inTemplates} template${inTemplates === 1 ? '' : 's'}` : '',
          ].filter(Boolean);
          return `This class is still used by ${parts.join(' and ')}. Remove those first.`;
        }
        const now = Date.now();
        updateList('classes', (items) => items.map((item) => (item.id === id ? tombstone(item, now) : item)));
        return null;
      },

      addStudent(classId, name) {
        const target = classById.get(classId);
        const trimmed = name.trim();
        if (!target || target.deleted) return 'This class no longer exists.';
        if (!trimmed) return 'Enter a student name first.';
        if (target.students.some((student) => sameName(student.name, trimmed))) return 'This student is already in the class.';
        updateClass(classId, (item) => ({ ...item, students: [...item.students, { id: createId(), name: trimmed }] }));
        return null;
      },

      removeStudent(classId, studentId) {
        updateClass(classId, (item) => ({ ...item, students: item.students.filter((student) => student.id !== studentId) }));
      },

      saveWeekAsTemplate(start, name) {
        const weekEntries = entriesInWeek(entries, start);
        if (!weekEntries.length) return 'Add a class before saving a template.';
        const trimmed = name.trim() || `Week template ${templates.length + 1}`;
        const template = createWeekTemplate(trimmed, weekEntries, start, Date.now());
        updateList('templates', (items) => [...items, template]);
        return null;
      },

      applyTemplate(templateId, start) {
        const template = templates.find((item) => item.id === templateId);
        if (!template) return 'This template no longer exists.';
        updateList('entries', (items) => applyTemplateToWeek(template, items, start, Date.now()));
        return null;
      },

      renameTemplate(id, name) {
        const trimmed = name.trim();
        if (!trimmed) return 'Enter a template name first.';
        const now = Date.now();
        updateList('templates', (items) => items.map((item) => (item.id === id ? touch({ ...item, name: trimmed }, now) : item)));
        return null;
      },

      deleteTemplate(id) {
        const now = Date.now();
        updateList('templates', (items) => items.map((item) => (item.id === id ? tombstone(item, now) : item)));
      },

      getState: () => stateRef.current,
      updateState: (update) => setState(update),
    };
  }, [hydrated, entries, classes, templates, classById, pendingChanges, weeklyReminder, updateList, updateClass]);

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}
