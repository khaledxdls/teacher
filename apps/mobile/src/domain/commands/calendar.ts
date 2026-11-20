import { calendarSettingsOf } from '../calendar';
import { isDateKey } from '../dates';
import { fail } from '../errors';
import { findLive, removeById, touch, upsert } from '../records';
import { CALENDAR_SETTINGS_ID, CalendarEvent, CalendarEventDraft, CalendarSettings, DateKey, PlannerState } from '../types';
import { CommandContext, CommandResult, done } from './types';

export function saveEvent(state: PlannerState, draft: CalendarEventDraft, ctx: CommandContext): CommandResult<CalendarEvent> {
  const title = draft.title.trim();
  if (!title) return fail('eventTitleRequired');
  if (!isDateKey(draft.startDate) || !isDateKey(draft.endDate) || draft.endDate < draft.startDate) return fail('eventDatesInvalid');
  const event = touch<CalendarEvent>({ ...draft, title, updatedAt: 0 }, ctx.now);
  return done({ ...state, events: upsert(state.events, event) }, event);
}

export function deleteEvent(state: PlannerState, input: { id: string }, ctx: CommandContext): CommandResult {
  if (!findLive(state.events, input.id)) return fail('eventMissing');
  return done({ ...state, events: removeById(state.events, input.id, ctx.now) });
}

/** Turns Week A/B rotation on or off; `anchorWeek` is any date in a week that is "Week A". */
export function setRotation(state: PlannerState, input: { enabled: boolean; anchorWeek: DateKey | null }, ctx: CommandContext): CommandResult {
  if (input.enabled && (!input.anchorWeek || !isDateKey(input.anchorWeek))) return fail('rotationAnchorRequired');
  const current = calendarSettingsOf(state.settings);
  const next = touch<CalendarSettings>({
    ...current,
    id: CALENDAR_SETTINGS_ID,
    rotation: { enabled: input.enabled, anchorWeek: input.anchorWeek ?? current.rotation.anchorWeek },
  }, ctx.now);
  return done({ ...state, settings: upsert(state.settings, next) });
}
