import { useMemo } from 'react';
import { Text } from 'react-native';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ListRow from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import { doneFollowUps, openFollowUps } from '../../domain/followUps';
import { ScheduleEntry } from '../../domain/types';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { useClassById, useLessons, usePlannerActions } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';
import { useSharedStyles } from '../../theme/sharedStyles';

export default function FollowUpsScreen() {
  const styles = useStyles();
  const shared = useSharedStyles();
  const { t, formatDate } = useI18n();
  const lessons = useLessons();
  const classById = useClassById();
  const actions = usePlannerActions();
  const toast = useToast();
  const feedback = useActionFeedback(toast.show);

  const open = useMemo(() => openFollowUps(lessons), [lessons]);
  const done = useMemo(() => doneFollowUps(lessons), [lessons]);

  const source = (lesson: ScheduleEntry) => t('followUps.source', {
    subject: lesson.subject,
    className: classById.get(lesson.classId)?.name ?? t('common.unknownClass'),
    date: formatDate(lesson.date, 'dayMonth'),
  });

  const row = (lesson: ScheduleEntry, markDone: boolean) => (
    <ListRow
      key={lesson.id}
      divider
      title={lesson.notes!.trim()}
      subtitle={source(lesson)}
      trailing={(
        <Button
          variant={markDone ? 'secondary' : 'text'}
          label={t(markDone ? 'followUps.markDone' : 'followUps.reopen')}
          onPress={() => feedback(actions.setFollowUpDone({ id: lesson.id, done: markDone }))}
          style={styles.action}
        />
      )}
    />
  );

  return (
    <Screen toastMessage={toast.message}>
      <Card flush title={t('followUps.open')}>
        {open.map((lesson) => row(lesson, true))}
        {open.length === 0 && <Text style={shared.emptyText}>{t('followUps.empty')}</Text>}
      </Card>
      {done.length > 0 && (
        <Card flush title={t('followUps.recentlyDone')}>
          {done.map((lesson) => row(lesson, false))}
        </Card>
      )}
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  action: { minHeight: 36, paddingVertical: 8, paddingHorizontal: 12 },
}));
