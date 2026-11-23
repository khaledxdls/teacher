/**
 * Every synced record carries sync metadata:
 * - `updatedAt`: client timestamp (ms) of the last change, used for last-write-wins merging.
 * - `deleted`: tombstone flag; deleted records are kept so the deletion can sync to other devices.
 * - `dirty`: local-only flag marking changes that have not been pushed to the server yet.
 *
 * Data that several devices may edit independently (each student, each score, each
 * attendance or homework mark) is its own record, so concurrent edits never overwrite
 * each other wholesale.
 */
export type SyncMeta = { updatedAt: number; deleted?: boolean; dirty?: boolean };
export type SyncedRecord = SyncMeta & { id: string };

/** `YYYY-MM-DD` in local time. */
export type DateKey = string;
/** `HH:MM`, 24-hour. */
export type TimeOfDay = string;

export type SavedClass = SyncedRecord & { name: string };

export type Student = SyncedRecord & {
  classId: string;
  name: string;
  /** Free text such as allergies or learning needs. */
  notes?: string;
  /** Parent or guardian contact details. */
  contact?: string;
};

export type LessonResource = { id: string; label: string; url: string };

/** What the teacher plans for one lesson. */
export type LessonPlan = {
  objectives?: string;
  /** Links to slides, worksheets, videos… (files are shared as links, e.g. from a drive). */
  resources?: LessonResource[];
  /** Homework set in this lesson; enables homework tracking for it. */
  homework?: string;
  homeworkDue?: DateKey;
};

export type ScheduleEntry = SyncedRecord & {
  date: DateKey;
  startTime: TimeOfDay;
  endTime: TimeOfDay;
  subject: string;
  classId: string;
  room: string;
  /** After-class notes; open notes appear in the follow-ups list until marked done. */
  notes?: string;
  notesDone?: boolean;
  plan?: LessonPlan;
  /** Shared by all lessons created from one repeating lesson. */
  seriesId?: string;
};

/** The editable part of a lesson; sync metadata is added when it is saved. */
export type EntryDraft = Omit<ScheduleEntry, keyof SyncMeta>;

export type TemplateEntry = Pick<ScheduleEntry, 'startTime' | 'endTime' | 'subject' | 'classId' | 'room'> & {
  /** 0 = first day of the teaching week (Friday). */
  day: number;
};
export type ScheduleTemplate = SyncedRecord & { name: string; entries: TemplateEntry[] };

/** A test or assignment. Scores are separate `Score` records. */
export type Assessment = SyncedRecord & { classId: string; title: string; date: DateKey; maxScore: number };
export type AssessmentDraft = Omit<Assessment, keyof SyncMeta>;

/** One student's score on one assessment. Id: `${assessmentId}:${studentId}`. */
export type Score = SyncedRecord & { assessmentId: string; studentId: string; value: number };

export type AttendanceStatus = 'present' | 'late' | 'absent';
/** One student's attendance in one lesson. Id: `${lessonId}:${studentId}`. */
export type AttendanceMark = SyncedRecord & { lessonId: string; studentId: string; status: AttendanceStatus };

export type HomeworkStatus = 'done' | 'late' | 'missing';
/** Whether a student handed in the homework set in a lesson. Id: `${lessonId}:${studentId}`. */
export type HomeworkMark = SyncedRecord & { lessonId: string; studentId: string; status: HomeworkStatus };

export type BehaviorKind = 'positive' | 'negative';
/** A quick participation/behaviour note during a lesson. */
export type BehaviorNote = SyncedRecord & {
  studentId: string;
  classId: string;
  lessonId?: string;
  date: DateKey;
  kind: BehaviorKind;
  note?: string;
};

export type CalendarEventKind = 'holiday' | 'term';
/** A school holiday or term, covering `startDate` to `endDate` inclusive. */
export type CalendarEvent = SyncedRecord & { title: string; kind: CalendarEventKind; startDate: DateKey; endDate: DateKey };
export type CalendarEventDraft = Omit<CalendarEvent, keyof SyncMeta>;

/** Week A/B rotation: `anchorWeek` is the first day of a known "Week A". */
export type CalendarSettings = SyncedRecord & { rotation: { enabled: boolean; anchorWeek: DateKey | null } };
export const CALENDAR_SETTINGS_ID = 'calendar';

export type PlannerState = {
  entries: ScheduleEntry[];
  classes: SavedClass[];
  students: Student[];
  templates: ScheduleTemplate[];
  assessments: Assessment[];
  scores: Score[];
  attendance: AttendanceMark[];
  homework: HomeworkMark[];
  behavior: BehaviorNote[];
  events: CalendarEvent[];
  /** Singleton settings records (currently only the calendar settings). */
  settings: CalendarSettings[];
};

export const emptyPlannerState: PlannerState = {
  entries: [], classes: [], students: [], templates: [], assessments: [], scores: [],
  attendance: [], homework: [], behavior: [], events: [], settings: [],
};

/** Deterministic id for per-student records of a lesson or assessment. */
export const pairId = (parentId: string, studentId: string) => `${parentId}:${studentId}`;
