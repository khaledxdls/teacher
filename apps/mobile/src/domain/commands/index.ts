import * as assessments from './assessments';
import * as calendar from './calendar';
import * as classes from './classes';
import * as lessons from './lessons';
import * as templates from './templates';

/** Every planner command, keyed by name. Each is `(state, input, context) => CommandResult`. */
export const commands = {
  saveLesson: lessons.saveLesson,
  deleteLesson: lessons.deleteLesson,
  setFollowUpDone: lessons.setFollowUpDone,

  addClass: classes.addClass,
  renameClass: classes.renameClass,
  deleteClass: classes.deleteClass,
  addStudent: classes.addStudent,
  updateStudent: classes.updateStudent,
  removeStudent: classes.removeStudent,

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
};

export type Commands = typeof commands;
export type { CommandContext, CommandResult } from './types';
export { NO_REPEAT } from './lessons';
export type { SaveLessonInput } from './lessons';
export type { StudentPatch } from './classes';
