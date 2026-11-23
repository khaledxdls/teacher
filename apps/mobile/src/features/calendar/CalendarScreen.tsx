import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ListRow from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import SegmentedControl from '../../components/ui/SegmentedControl';
import { rotationWeek, RotationWeek } from '../../domain/calendar';
import { addDaysToKey, dateKey, todayKey, weekStart } from '../../domain/dates';
import { CalendarEvent, CalendarEventKind } from '../../domain/types';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { useCalendar, usePlannerActions } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';
import { useTheme } from '../../theme/ThemeProvider';
import { useSharedStyles } from '../../theme/sharedStyles';
import EventFormModal from './EventFormModal';

export default function CalendarScreen() {
  const styles = useStyles();
  const shared = useSharedStyles();
  const { palette } = useTheme();
  const { t, formatDate } = useI18n();
  const { events, settings } = useCalendar();
  const actions = usePlannerActions();
  const confirm = useConfirm();
  const toast = useToast();
  const feedback = useActionFeedback(toast.show);
  const [editing, setEditing] = useState<CalendarEvent | CalendarEventKind | null>(null);

  const today = todayKey();
  const thisWeek = dateKey(weekStart(new Date()));
  const currentRotation: RotationWeek = rotationWeek(settings, today) ?? 'A';

  function setRotation(enabled: boolean, week: RotationWeek = currentRotation) {
    // The anchor is a Week A start: this week if it is A, otherwise the previous week.
    feedback(actions.setRotation({ enabled, anchorWeek: week === 'A' ? thisWeek : addDaysToKey(thisWeek, -7) }));
  }

  const remove = (event: CalendarEvent) =>
    confirm(t('calendar.deleteTitle', { title: event.title }), t('calendar.deleteMessage'), t('common.delete'), () =>
      feedback(actions.deleteEvent({ id: event.id })));

  return (
    <Screen toastMessage={toast.message}>
      <Card title={t('calendar.rotation')} action={(
        <Switch
          value={settings.rotation.enabled}
          onValueChange={(enabled) => setRotation(enabled)}
          trackColor={{ true: palette.primary }}
          accessibilityLabel={t('calendar.rotation')}
        />
      )}>
        <Text style={shared.hint}>{t('calendar.rotationHint')}</Text>
        {settings.rotation.enabled && (
          <View style={styles.rotation}>
            <Text style={styles.rotationLabel}>{t('calendar.thisWeekIs')}</Text>
            <SegmentedControl
              options={[{ value: 'A', label: t('calendar.weekA') }, { value: 'B', label: t('calendar.weekB') }]}
              value={currentRotation}
              onChange={(week) => setRotation(true, week)}
            />
          </View>
        )}
      </Card>

      <Card flush title={t('calendar.events')}>
        {events.map((event) => (
          <ListRow
            key={event.id}
            divider
            title={event.title}
            subtitle={t('calendar.range', { from: formatDate(event.startDate, 'dayMonthYear'), to: formatDate(event.endDate, 'dayMonthYear') })}
            onPress={() => setEditing(event)}
            trailing={<Badge tone={event.kind === 'holiday' ? 'warning' : 'primary'} label={t(event.kind === 'holiday' ? 'calendar.holiday' : 'calendar.term').toUpperCase()} />}
          />
        ))}
        {events.length === 0 && <EmptyState icon="sunny-outline" title={t('empty.calendarTitle')} message={t('empty.calendarMessage')} />}
        <View style={styles.addRow}>
          <Button label={t('calendar.addHoliday')} variant="secondary" onPress={() => setEditing('holiday')} style={styles.addButton} />
          <Button label={t('calendar.addTerm')} variant="secondary" onPress={() => setEditing('term')} style={styles.addButton} />
        </View>
      </Card>

      <EventFormModal target={editing} onClose={() => setEditing(null)} onDelete={remove} />
    </Screen>
  );
}

const useStyles = createStyles((c) => ({
  rotation: { gap: 8, marginTop: 4 },
  rotationLabel: { color: c.text, fontWeight: '600', textAlign: 'auto' },
  addRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.divider },
  addButton: { flex: 1 },
}));
