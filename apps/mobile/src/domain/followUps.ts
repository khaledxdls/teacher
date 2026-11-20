import { sortEntries } from './schedule';
import { ScheduleEntry } from './types';

export const hasOpenFollowUp = (entry: ScheduleEntry) => Boolean(entry.notes?.trim()) && !entry.notesDone;

/** Lessons with after-class notes that are not done yet, oldest first. */
export const openFollowUps = (entries: ScheduleEntry[]) => sortEntries(entries.filter(hasOpenFollowUp));

/** Recently completed follow-ups, newest first. */
export const doneFollowUps = (entries: ScheduleEntry[], limit = 20) =>
  sortEntries(entries.filter((entry) => Boolean(entry.notes?.trim()) && entry.notesDone)).reverse().slice(0, limit);
