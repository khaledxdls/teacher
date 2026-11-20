import { isSchoolDay } from '../calendar';
import { fail } from '../errors';
import { alive, findLive, removeById, updateById } from '../records';
import { entriesInWeek } from '../schedule';
import { applyTemplateToWeek, createWeekTemplate } from '../templates';
import { PlannerState, ScheduleTemplate } from '../types';
import { CommandContext, CommandResult, done } from './types';

export function saveWeekAsTemplate(state: PlannerState, input: { start: Date; name: string }, ctx: CommandContext): CommandResult<ScheduleTemplate> {
  const weekEntries = entriesInWeek(alive(state.entries), input.start);
  if (!weekEntries.length) return fail('weekEmpty');
  const name = input.name.trim() || `Week template ${alive(state.templates).length + 1}`;
  const template = createWeekTemplate(name, weekEntries, input.start, ctx.now);
  return done({ ...state, templates: [...state.templates, template] }, template);
}

export function applyTemplate(state: PlannerState, input: { templateId: string; start: Date }, ctx: CommandContext): CommandResult {
  const template = findLive(state.templates, input.templateId);
  if (!template) return fail('templateMissing');
  const entries = applyTemplateToWeek(template, state.entries, input.start, ctx.now, (date) => isSchoolDay(state.events, date));
  return done({ ...state, entries });
}

export function renameTemplate(state: PlannerState, input: { id: string; name: string }, ctx: CommandContext): CommandResult {
  const name = input.name.trim();
  if (!name) return fail('templateNameRequired');
  if (!findLive(state.templates, input.id)) return fail('templateMissing');
  return done({ ...state, templates: updateById(state.templates, input.id, (item) => ({ ...item, name }), ctx.now) });
}

export function deleteTemplate(state: PlannerState, input: { id: string }, ctx: CommandContext): CommandResult {
  if (!findLive(state.templates, input.id)) return fail('templateMissing');
  return done({ ...state, templates: removeById(state.templates, input.id, ctx.now) });
}
