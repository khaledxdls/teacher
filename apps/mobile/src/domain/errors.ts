/**
 * Validation failures are returned as codes, not sentences, so the UI can translate them
 * (see `errors.*` in src/i18n). Params fill placeholders such as `{subject}`.
 */
export type ErrorCode =
  | 'scheduleConflict'
  | 'subjectRequired'
  | 'classRequired'
  | 'endBeforeStart'
  | 'repeatUntilInvalid'
  | 'classNameRequired'
  | 'classNameTaken'
  | 'classMissing'
  | 'classInUse'
  | 'studentNameRequired'
  | 'studentExists'
  | 'lessonMissing'
  | 'weekEmpty'
  | 'templateMissing'
  | 'templateNameRequired'
  | 'assessmentTitleRequired'
  | 'assessmentMaxInvalid'
  | 'assessmentMissing'
  | 'scoreOutOfRange'
  | 'eventTitleRequired'
  | 'eventDatesInvalid'
  | 'eventMissing'
  | 'rotationAnchorRequired'
  | 'dateInvalid';

export type ActionError = { code: ErrorCode; params?: Record<string, string | number> };

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: ActionError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (code: ErrorCode, params?: ActionError['params']): { ok: false; error: ActionError } =>
  ({ ok: false, error: { code, params } });
