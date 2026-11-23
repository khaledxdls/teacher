import { BehaviorNote } from './types';

export type BehaviorCounts = { positive: number; negative: number };

/** Positive/negative totals per student id (live notes only). */
export function behaviorCountsByStudent(notes: BehaviorNote[]) {
  const counts = new Map<string, BehaviorCounts>();
  for (const note of notes) {
    if (note.deleted) continue;
    const current = counts.get(note.studentId) ?? { positive: 0, negative: 0 };
    current[note.kind] += 1;
    counts.set(note.studentId, current);
  }
  return counts;
}

/** Notes newest first (by date, then creation time). */
export const sortBehaviorNotes = (notes: BehaviorNote[]) =>
  [...notes].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
