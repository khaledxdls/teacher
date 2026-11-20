/**
 * Every synced record carries sync metadata:
 * - `updatedAt`: client timestamp (ms) of the last change, used for last-write-wins merging.
 * - `deleted`: tombstone flag; deleted records are kept so the deletion can sync to other devices.
 * - `dirty`: local-only flag marking changes that have not been pushed to the server yet.
 */
export type SyncMeta = { updatedAt: number; deleted?: boolean; dirty?: boolean };
export type SyncedRecord = SyncMeta & { id: string };

/** `YYYY-MM-DD` in local time. */
export type DateKey = string;
/** `HH:MM`, 24-hour. */
export type TimeOfDay = string;

export type AttendanceStatus = 'present' | 'late' | 'absent';

export type Student = {
  id: string;
  name: string;
  /** Free text such as allergies or learning needs. */
  notes?: string;
  /** Parent or guardian contact details. */
  contact?: string;
};

export type SavedClass = SyncedRecord & { name: string; students: Student[] };

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
  /** Attendance by student id. Students without a value are unmarked. */
  attendance?: Record<string, AttendanceStatus>;
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

/** A test or assignment, with one score per student (absent = not graded). */
export type Assessment = SyncedRecord & {
  classId: string;
  title: string;
  date: DateKey;
  maxScore: number;
  scores: Record<string, number>;
};
export type AssessmentDraft = Omit<Assessment, keyof SyncMeta>;

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
  templates: ScheduleTemplate[];
  assessments: Assessment[];
  events: CalendarEvent[];
  /** Singleton settings records (currently only the calendar settings). */
  settings: CalendarSettings[];
};

export const emptyPlannerState: PlannerState = {
  entries: [], classes: [], templates: [], assessments: [], events: [], settings: [],
};
