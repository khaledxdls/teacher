import * as Notifications from 'expo-notifications';
import { dateTimeOf } from '../domain/dates';
import { sortEntries } from '../domain/schedule';
import { DateKey, TimeOfDay } from '../domain/types';

/** A lesson reminder with its (already translated) text. */
export type ClassReminder = { id: string; date: DateKey; startTime: TimeOfDay; title: string; body: string };
export type NotificationText = { title: string; body: string };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const WEEKLY_REMINDER_COUNT = 12;
// iOS keeps at most 64 pending local notifications. Leave room for the weekly reminders.
const MAX_CLASS_REMINDERS = 40;
const CLASS_REMINDER_LEAD_MINUTES = 15;

// Each reschedule cancels and re-creates notifications. Run them one at a time so
// overlapping calls (e.g. two quick edits) cannot interleave and create duplicates.
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') await Notifications.requestPermissionsAsync();
}

async function cancelByKind(kind: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.content.data?.kind === kind)
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)),
  );
}

export const scheduleWeeklyReminder = (enabled: boolean, text: NotificationText) => serialize(async () => {
  await cancelByKind('weekly-reminder');
  if (!enabled) return;
  const now = new Date();
  const nextFriday = new Date(now);
  const daysUntilFriday = (5 - now.getDay() + 7) % 7;
  nextFriday.setDate(now.getDate() + (daysUntilFriday || 7));
  nextFriday.setHours(8, 0, 0, 0);

  // Android does not support calendar triggers in this Expo version.
  // Queue the next Fridays as one-time date notifications instead; they are refreshed on every launch.
  await Promise.all(Array.from({ length: WEEKLY_REMINDER_COUNT }, (_, index) => {
    const date = new Date(nextFriday);
    date.setDate(nextFriday.getDate() + index * 7);
    return Notifications.scheduleNotificationAsync({
      content: { ...text, data: { kind: 'weekly-reminder' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }));
});

const reminderTime = (reminder: ClassReminder) => {
  const date = dateTimeOf(reminder.date, reminder.startTime);
  date.setMinutes(date.getMinutes() - CLASS_REMINDER_LEAD_MINUTES);
  return date;
};

/** Replaces all class reminders. Only the soonest upcoming classes are scheduled (see MAX_CLASS_REMINDERS). */
export const scheduleClassReminders = (entries: ClassReminder[]) => serialize(async () => {
  await cancelByKind('class-reminder');
  const now = Date.now();
  const upcoming = sortEntries(entries)
    .map((entry) => ({ entry, date: reminderTime(entry) }))
    .filter(({ date }) => date.getTime() > now)
    .slice(0, MAX_CLASS_REMINDERS);

  await Promise.all(upcoming.map(({ entry, date }) => Notifications.scheduleNotificationAsync({
    content: { title: entry.title, body: entry.body, data: { kind: 'class-reminder', entryId: entry.id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  })));
});
