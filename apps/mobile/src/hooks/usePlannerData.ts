import { useCallback, useEffect, useState } from 'react';
import {
  applyTemplateToWeek,
  createId,
  createWeekTemplate,
  entriesInWeek,
  findScheduleConflict,
  mergeClasses,
  migrateTemplate,
  sameName,
  SavedClass,
  ScheduleEntry,
  ScheduleTemplate,
} from '../domain/schedule';
import { requestNotificationPermission, scheduleClassReminders, scheduleWeeklyReminder } from '../services/notifications';
import { loadSchedule, saveClasses, saveEntries, saveTemplates, saveWeeklyReminder } from '../services/storage';

const warn = (label: string) => (error: unknown) => console.warn(label, error);

/** Error message to show the user, or `null` when the action succeeded. */
export type ActionError = string | null;

/**
 * Owns all persisted planner state: loads it once, then saves and reschedules
 * notifications whenever it changes. Nothing is written until loading has finished,
 * so the initial empty state can never overwrite stored data.
 */
export function usePlannerData() {
  const [hydrated, setHydrated] = useState(false);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [classes, setClasses] = useState<SavedClass[]>([]);
  const [weeklyReminder, setWeeklyReminder] = useState(true);

  useEffect(() => {
    let active = true;
    loadSchedule()
      .then((data) => {
        if (!active) return;
        setEntries(data.entries);
        setTemplates(data.templates.map(migrateTemplate));
        setClasses(mergeClasses(data.classes, data.entries));
        setWeeklyReminder(data.weeklyReminder);
        setHydrated(true);
      })
      // Stay un-hydrated on failure so the empty in-memory state never overwrites stored data.
      .catch(warn('Failed to load planner data'));
    requestNotificationPermission().catch(warn('Notification permission request failed'));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveEntries(entries).catch(warn('Failed to save entries'));
    scheduleClassReminders(entries).catch(warn('Failed to schedule class reminders'));
  }, [hydrated, entries]);

  useEffect(() => {
    if (hydrated) saveTemplates(templates).catch(warn('Failed to save templates'));
  }, [hydrated, templates]);

  useEffect(() => {
    if (hydrated) saveClasses(classes).catch(warn('Failed to save classes'));
  }, [hydrated, classes]);

  useEffect(() => {
    if (!hydrated) return;
    saveWeeklyReminder(weeklyReminder).catch(warn('Failed to save reminder setting'));
    scheduleWeeklyReminder(weeklyReminder).catch(warn('Failed to schedule weekly reminder'));
  }, [hydrated, weeklyReminder]);

  const saveEntry = useCallback((entry: ScheduleEntry): ActionError => {
    const conflict = findScheduleConflict(entry, entries);
    if (conflict) return `${conflict.subject} is already scheduled at this time.`;
    setEntries((current) => current.some((item) => item.id === entry.id)
      ? current.map((item) => (item.id === entry.id ? entry : item))
      : [...current, entry]);
    return null;
  }, [entries]);

  const deleteEntry = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  /** Returns the saved class with this name, creating it if needed. */
  const addClass = useCallback((name: string): SavedClass => {
    const existing = classes.find((item) => sameName(item.name, name));
    if (existing) return existing;
    const created: SavedClass = { id: createId(), name: name.trim(), students: [] };
    setClasses((current) => [...current, created]);
    return created;
  }, [classes]);

  const addStudent = useCallback((classId: string, name: string): ActionError => {
    const target = classes.find((item) => item.id === classId);
    if (!target) return 'This class no longer exists.';
    if (target.students.some((student) => sameName(student.name, name))) return 'This student is already in the class.';
    const student = { id: createId(), name: name.trim() };
    setClasses((current) => current.map((item) => (
      item.id === classId ? { ...item, students: [...item.students, student] } : item
    )));
    return null;
  }, [classes]);

  const removeStudent = useCallback((classId: string, studentId: string) => {
    setClasses((current) => current.map((item) => (
      item.id === classId ? { ...item, students: item.students.filter((student) => student.id !== studentId) } : item
    )));
  }, []);

  const saveWeekAsTemplate = useCallback((start: Date): ActionError => {
    const weekEntries = entriesInWeek(entries, start);
    if (!weekEntries.length) return 'Add a class before saving a template.';
    setTemplates((current) => [...current, createWeekTemplate(`Week template ${current.length + 1}`, weekEntries, start)]);
    return null;
  }, [entries]);

  const applyLatestTemplate = useCallback((start: Date): ActionError => {
    const template = templates.at(-1);
    if (!template) return 'Save a week as a template first.';
    setEntries((current) => applyTemplateToWeek(template, current, start));
    return null;
  }, [templates]);

  return {
    hydrated,
    entries,
    templates,
    classes,
    weeklyReminder,
    setWeeklyReminder,
    saveEntry,
    deleteEntry,
    addClass,
    addStudent,
    removeStudent,
    saveWeekAsTemplate,
    applyLatestTemplate,
  };
}

export type PlannerData = ReturnType<typeof usePlannerData>;
