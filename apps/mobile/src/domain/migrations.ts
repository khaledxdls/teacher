import { createId, PlannerState, SavedClass, sameName } from './schedule';

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
 * - entries and template entries reference classes by id instead of by name,
 * - templates saved before the off-by-one fix (no `version: 2`) get 0-based days,
 * - every record gets sync metadata and is marked dirty so it is uploaded on first sync.
 */
export function migrateFromV1(legacy: LegacyData, now: number): PlannerState {
  const classes: SavedClass[] = [];
  const usedIds = new Set<string>();
  const findClass = (name: string) => classes.find((item) => sameName(item.name, name));
  const ensureClass = (name: string, id?: string, students: LegacyClass['students'] = []) => {
    const trimmed = name.trim();
    const existing = findClass(trimmed);
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

  return { entries, classes, templates };
}
