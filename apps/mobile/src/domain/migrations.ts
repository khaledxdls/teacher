import { createId, sameName } from './records';
import {
  AttendanceMark,
  AttendanceStatus,
  emptyPlannerState,
  pairId,
  PlannerState,
  SavedClass,
  Score,
  Student,
  SyncedRecord,
} from './types';

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

/** Fields that older versions embedded inside parent records. */
type EmbeddedStudent = { id: string; name: string; notes?: string; contact?: string };
type WithEmbeddedStudents = SyncedRecord & { students?: EmbeddedStudent[] };
type WithEmbeddedScores = SyncedRecord & { scores?: Record<string, number> };
type WithEmbeddedAttendance = SyncedRecord & { attendance?: Record<string, AttendanceStatus> };

/**
 * Moves data that older versions stored inside parent records into separate records:
 * students out of classes, scores out of assessments, attendance out of lessons.
 * Idempotent and safe to run on every load and after every merge from the server
 * (another device may still run an older version). Existing separate records win.
 */
export function upgradeEmbeddedRecords(state: PlannerState, now: number): PlannerState {
  let changed = false;
  const students = [...state.students];
  const scores = [...state.scores];
  const attendance = [...state.attendance];
  const has = (list: SyncedRecord[], id: string) => list.some((item) => item.id === id);

  const strip = <T extends SyncedRecord, K extends string>(record: T, field: K) => {
    const { [field]: _removed, ...rest } = record as T & Record<K, unknown>;
    changed = true;
    return { ...rest, updatedAt: Math.max(now, record.updatedAt), dirty: true } as unknown as T;
  };

  const classes = state.classes.map((item) => {
    const embedded = (item as WithEmbeddedStudents).students;
    if (!Array.isArray(embedded)) return item;
    for (const student of embedded) {
      if (!student?.id || has(students, student.id)) continue;
      students.push({ ...student, classId: item.id, updatedAt: now, dirty: true, ...(item.deleted ? { deleted: true } : {}) });
    }
    return strip(item, 'students');
  });

  const assessments = state.assessments.map((item) => {
    const embedded = (item as WithEmbeddedScores).scores;
    if (!embedded || typeof embedded !== 'object') return item;
    for (const [studentId, value] of Object.entries(embedded)) {
      const id = pairId(item.id, studentId);
      if (typeof value !== 'number' || has(scores, id)) continue;
      scores.push({ id, assessmentId: item.id, studentId, value, updatedAt: now, dirty: true } satisfies Score);
    }
    return strip(item, 'scores');
  });

  const entries = state.entries.map((item) => {
    const embedded = (item as WithEmbeddedAttendance).attendance;
    if (!embedded || typeof embedded !== 'object') return item;
    for (const [studentId, status] of Object.entries(embedded)) {
      const id = pairId(item.id, studentId);
      if (!status || has(attendance, id)) continue;
      attendance.push({ id, lessonId: item.id, studentId, status, updatedAt: now, dirty: true } satisfies AttendanceMark);
    }
    return strip(item, 'attendance');
  });

  return changed ? { ...state, classes, assessments, entries, students, scores, attendance } : state;
}

/**
 * Converts v1 data to the current model: classes de-duplicated by name, lessons and
 * templates linked by class id, legacy template days fixed, students as separate
 * records, and everything marked dirty so it is uploaded on first sync.
 */
export function migrateFromV1(legacy: LegacyData, now: number): PlannerState {
  const classes: SavedClass[] = [];
  const students: Student[] = [];
  const usedIds = new Set<string>();
  const ensureClass = (name: string, id?: string, classStudents: LegacyClass['students'] = []) => {
    const trimmed = name.trim();
    const existing = classes.find((item) => sameName(item.name, trimmed));
    if (existing) return existing;
    const classId = id && !usedIds.has(id) ? id : createId();
    usedIds.add(classId);
    const created: SavedClass = { id: classId, name: trimmed, updatedAt: now, dirty: true };
    classes.push(created);
    for (const student of Array.isArray(classStudents) ? classStudents : []) {
      if (student?.id && student.name) students.push({ ...student, classId, updatedAt: now, dirty: true });
    }
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

  return { ...emptyPlannerState, entries, classes, students, templates };
}

/** Fills collections added after a state was saved and upgrades embedded data. */
export const normalizeState = (state: Partial<PlannerState>, now = Date.now()): PlannerState => upgradeEmbeddedRecords({
  ...emptyPlannerState,
  ...Object.fromEntries(Object.entries(state).filter(([, value]) => Array.isArray(value))),
}, now);
