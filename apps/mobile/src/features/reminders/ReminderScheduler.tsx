import { useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { reportError } from '../../services/errorReporting';
import { ClassReminder, requestNotificationPermission, scheduleClassReminders, scheduleWeeklyReminder } from '../../services/notifications';
import { useClassById, useLessons, usePlannerHydrated } from '../../state/planner';
import { usePreferences } from '../../state/PreferencesProvider';

/**
 * Keeps scheduled notifications in line with the planner: lesson reminders whenever lessons
 * change and the weekly planning reminder whenever its setting or the language changes.
 * Renders nothing.
 */
export function ReminderScheduler() {
  const hydrated = usePlannerHydrated();
  const lessons = useLessons();
  const classById = useClassById();
  const { preferences, loaded } = usePreferences();
  const { t } = useI18n();

  useEffect(() => {
    requestNotificationPermission().catch((error) => reportError(error, { where: 'notificationPermission' }));
  }, []);

  const reminders = useMemo<ClassReminder[]>(() => lessons.map((lesson) => {
    const className = classById.get(lesson.classId)?.name ?? t('common.unknownClass');
    return {
      id: lesson.id,
      date: lesson.date,
      startTime: lesson.startTime,
      title: t('notifications.lessonTitle', { subject: lesson.subject }),
      body: lesson.room
        ? t('notifications.lessonBodyRoom', { className, room: lesson.room })
        : t('notifications.lessonBody', { className }),
    };
  }), [lessons, classById, t]);

  useEffect(() => {
    if (!hydrated) return;
    scheduleClassReminders(reminders).catch((error) => reportError(error, { where: 'scheduleClassReminders' }));
  }, [hydrated, reminders]);

  useEffect(() => {
    if (!loaded) return;
    const text = { title: t('notifications.weeklyTitle'), body: t('notifications.weeklyBody') };
    scheduleWeeklyReminder(preferences.weeklyReminder, text)
      .catch((error) => reportError(error, { where: 'scheduleWeeklyReminder' }));
  }, [loaded, preferences.weeklyReminder, t]);

  return null;
}
