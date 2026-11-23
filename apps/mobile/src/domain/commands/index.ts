import { mergeBackup, MergeSummary } from '../backup';
import { PlannerState } from '../types';
import * as assessments from './assessments';
import * as behavior from './behavior';
import * as calendar from './calendar';
import * as classes from './classes';
import * as lessons from './lessons';
import * as templates from './templates';
import { CommandContext, CommandResult, done } from './types';

/** Merges a parsed backup into the current data (newest version of each record wins). */
const importBackup = (state: PlannerState, input: { data: PlannerState }, ctx: CommandContext): CommandResult<MergeSummary> => {
  const merged = mergeBackup(state, input.data, ctx.now);
  return done(merged.state, merged.summary);
};

/** Every planner command, keyed by name. Each is `(state, input, context) => CommandResult`. */
export const commands = {
  saveLesson: lessons.saveLesson,
  deleteLesson: lessons.deleteLesson,
  updateLessonNotes: lessons.updateLessonNotes,
  setFollowUpDone: lessons.setFollowUpDone,
  saveLessonPlan: lessons.saveLessonPlan,
  setAttendance: lessons.setAttendance,
  markAllPresent: lessons.markAllPresent,
  setHomework: lessons.setHomework,

  addClass: classes.addClass,
  renameClass: classes.renameClass,
  deleteClass: classes.deleteClass,
  addStudent: classes.addStudent,
  updateStudent: classes.updateStudent,
  removeStudent: classes.removeStudent,

  addBehaviorNote: behavior.addBehaviorNote,
  deleteBehaviorNote: behavior.deleteBehaviorNote,

  saveWeekAsTemplate: templates.saveWeekAsTemplate,
  applyTemplate: templates.applyTemplate,
  renameTemplate: templates.renameTemplate,
  deleteTemplate: templates.deleteTemplate,

  saveAssessment: assessments.saveAssessment,
  setScore: assessments.setScore,
  deleteAssessment: assessments.deleteAssessment,

  saveEvent: calendar.saveEvent,
  deleteEvent: calendar.deleteEvent,
  setRotation: calendar.setRotation,

  importBackup,
};

export type Commands = typeof commands;
export type { CommandContext, CommandResult } from './types';
export { NO_REPEAT, normalizeUrl } from './lessons';
export type { SaveLessonInput } from './lessons';
export type { StudentPatch } from './classes';
export type { BehaviorInput } from './behavior';
