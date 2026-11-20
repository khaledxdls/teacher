import { createId, sameName } from './records';
import { emptyPlannerState, PlannerState, SavedClass } from './types';

/** Shapes stored by the first version of the app (keys ending in `-v1`). */
export type LegacyEntry = {
  id: string; date: string; startTime: string; endTime: string;
  subject: string; className: string; room: string; notes?: string;
};
export type LegacyTemplate = {
  id: string; name: string; version?: 2;
  entries: (Omit<LegacyEntry, 'id' | 'date' | 'notes'> & { day: number })[];
};
export type LegacyClass = { id: string; name: string; students?: { id: string; name: string }[] };
export type LegacyData = { entries: LegacyEntry[]; templates: LegacyTemplate[]; classes: LegacyClass[] };

/**
 * Converts v1 data to the current model:
 * - classes are de-duplicated by name and every class name used anywhere gets a class,
 * - lessons and template lessons reference classes by id instead of by name,
 * - templates saved before the off-by-one fix (no `version: 2`) get 0-based days,
 * - every record gets sync metadata and is marked dirty so it is uploaded on first sync.
 */
export function migrateFromV1(legacy: LegacyData, now: number): PlannerState {
  const classes: SavedClass[] = [];
  const usedIds = new Set<string>();
  const ensureClass = (name: string, id?: string, students: LegacyClass['students'] = []) => {
    const trimmed = name.trim();
    const existing = classes.find((item) => sameName(item.name, trimmed));
    if (existing) return existing;
    const classId = id && !usedIds.has(id) ? id : createId();
    usedIds.add(classId);
    const created: SavedClass = {
      id: classId, name: trimmed, students: Array.isArray(students) ? students : [], updatedAt: now, dirty: true,
    };
    classes.push(created);
    return created;
  };

  for (const item of legacy.classes) if (item?.name?.trim()) ensureClass(item.name, item.id, item.students);

  const entries = legacy.entries
    .filter((entry) => entry?.className?.trim())
    .map(({ className, ...entry }) => ({ ...entry, classId: ensureClass(className).id, updatedAt: now, dirty: true }));

  const templates = legacy.templates.map((template) => ({
    id: template.id,
    name: template.name,
    updatedAt: now,
    dirty: true,
    entries: template.entries
      .filter((entry) => entry?.className?.trim())
      .map(({ className, day, ...entry }) => ({
        ...entry,
        classId: ensureClass(className).id,
        day: template.version === 2 ? day : Math.max(0, day - 1),
      })),
  }));

  return { ...emptyPlannerState, entries, classes, templates };
}

/** Fills collections added after a state was saved (older v2 data has no grades or calendar). */
export const normalizeState = (state: Partial<PlannerState>): PlannerState => ({
  ...emptyPlannerState,
  ...Object.fromEntries(Object.entries(state).filter(([, value]) => Array.isArray(value))),
});
