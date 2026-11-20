import { ok, Result } from '../errors';
import { DateKey, PlannerState } from '../types';

/** Ambient values commands need; injected so commands stay pure and testable. */
export type CommandContext = { now: number; today: DateKey };

export type Outcome<T> = { state: PlannerState; value: T };
/** A command either fails validation or produces the next state (plus an optional value). */
export type CommandResult<T = void> = Result<Outcome<T>>;

export const done = <T = void>(state: PlannerState, value?: T): CommandResult<T> => ok({ state, value: value as T });
