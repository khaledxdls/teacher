import { useState } from 'react';
import { View } from 'react-native';
import Card from '../../components/ui/Card';
import ListRow from '../../components/ui/ListRow';
import { createBackup, parseBackup } from '../../domain/backup';
import { addMonths, dateKey, todayKey } from '../../domain/dates';
import { IcsEvent, toIcs } from '../../domain/ics';
import { sortEntries } from '../../domain/schedule';
import { PlannerState } from '../../domain/types';
import { useConfirm } from '../../hooks/useConfirm';
import { useI18n } from '../../i18n/I18nProvider';
import { reportError } from '../../services/errorReporting';
import { FILE_KINDS, pickTextFile, shareTextFile, SharingUnavailableError } from '../../services/export';
import { useClassById, useLessons, usePlannerActions, usePlannerStore } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';

const CALENDAR_MONTHS_AHEAD = 6;

/** Calendar export, backup and restore. */
export default function DataCard({ onMessage }: { onMessage: (message: string) => void }) {
  const styles = useStyles();
  const { t, tError } = useI18n();
  const lessons = useLessons();
  const classById = useClassById();
  const store = usePlannerStore();
  const actions = usePlannerActions();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function run(where: string, task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      if (error instanceof SharingUnavailableError) onMessage(t('report.shareUnavailable'));
      else {
        reportError(error, { where });
        onMessage(t('data.failed'));
      }
    } finally {
      setBusy(false);
    }
  }

  const exportCalendar = () => run('exportCalendar', async () => {
    const from = todayKey();
    const until = dateKey(addMonths(new Date(), CALENDAR_MONTHS_AHEAD));
    const upcoming = sortEntries(lessons.filter((lesson) => lesson.date >= from && lesson.date <= until));
    if (!upcoming.length) return onMessage(t('data.noUpcoming'));
    const events: IcsEvent[] = upcoming.map((lesson) => ({
      id: lesson.id,
      date: lesson.date,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      title: `${lesson.subject} · ${classById.get(lesson.classId)?.name ?? ''}`,
      location: lesson.room ? t('common.room', { room: lesson.room }) : undefined,
      description: [lesson.plan?.objectives, lesson.plan?.homework && `${t('lesson.homework')}: ${lesson.plan.homework}`].filter(Boolean).join('\n') || undefined,
    }));
    const calendarName = t('data.calendarName');
    await shareTextFile('classpilot-timetable', toIcs(events, { calendarName, now: new Date() }), FILE_KINDS.ics, calendarName);
  });

  const exportBackup = () => run('exportBackup', async () => {
    const content = createBackup(store.getState(), new Date());
    await shareTextFile(`classpilot-backup-${todayKey()}`, content, FILE_KINDS.json, t('data.exportBackup'));
  });

  const importBackup = () => run('importBackup', async () => {
    const text = await pickTextFile();
    if (text === null) return;
    const parsed = parseBackup(text);
    if (!parsed.ok) return onMessage(tError(parsed.error));
    confirm(t('data.importTitle'), t('data.importMessage'), t('data.importConfirm'), () => mergeIntoPlanner(parsed.value));
  });

  function mergeIntoPlanner(data: PlannerState) {
    const result = actions.importBackup({ data });
    onMessage(result.ok ? t('data.importDone', result.value) : tError(result.error));
  }

  return (
    <Card flush title={t('data.title')}>
      <View style={busy ? styles.busy : undefined}>
        <ListRow title={t('data.exportCalendar')} subtitle={t('data.exportCalendarHint')} onPress={() => void exportCalendar()} />
        <ListRow divider title={t('data.exportBackup')} subtitle={t('data.exportBackupHint')} onPress={() => void exportBackup()} />
        <ListRow divider title={t('data.importBackup')} subtitle={t('data.importBackupHint')} onPress={() => void importBackup()} />
      </View>
    </Card>
  );
}

const useStyles = createStyles(() => ({
  busy: { opacity: 0.5 },
}));
