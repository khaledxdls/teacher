import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from '../../components/feedback/Toast';
import Button from '../../components/ui/Button';
import PromptModal from '../../components/ui/PromptModal';
import { rotationWeek } from '../../domain/calendar';
import { addDays, addMonths, dateKey, todayKey, weekDays, weekStart } from '../../domain/dates';
import { entriesInMonth, entriesInWeek } from '../../domain/schedule';
import { ScheduleEntry, ScheduleTemplate } from '../../domain/types';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { useAttendanceIndex, useCalendar, useClassById, useLessons, usePlannerActions, useStudentsByClass, useTemplates } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';
import TemplatePickerModal from '../templates/TemplatePickerModal';
import LessonEditorModal, { EditorSession } from './components/LessonEditorModal';
import MonthView from './components/MonthView';
import PeriodNavigator, { ScheduleView } from './components/PeriodNavigator';
import ScheduleHeader from './components/ScheduleHeader';
import SummaryRow from './components/SummaryRow';
import WeekView from './components/WeekView';

export default function ScheduleScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t, tError, formatDate } = useI18n();
  const actions = usePlannerActions();
  const lessons = useLessons();
  const templates = useTemplates();
  const classById = useClassById();
  const calendar = useCalendar();
  const studentsByClass = useStudentsByClass();
  const attendance = useAttendanceIndex();
  const toast = useToast();
  const feedback = useActionFeedback(toast.show);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<ScheduleView>('week');
  const [editor, setEditor] = useState<EditorSession>(() => ({ key: 0, visible: false, date: new Date(), lesson: null }));
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [pickingTemplate, setPickingTemplate] = useState(false);

  const currentWeek = useMemo(() => weekStart(selectedDate), [selectedDate]);
  const days = useMemo(() => weekDays(currentWeek), [currentWeek]);
  const weekLessons = useMemo(() => entriesInWeek(lessons, currentWeek), [lessons, currentWeek]);
  const monthLessons = useMemo(() => entriesInMonth(lessons, selectedDate), [lessons, selectedDate]);
  const teachingDays = new Set(weekLessons.map((lesson) => lesson.date)).size;
  const weekLabel = `${formatDate(days[0], 'dayMonth')} – ${formatDate(days[6], 'dayMonth')}`;
  const rotation = rotationWeek(calendar.settings, dateKey(currentWeek));

  const shiftPeriod = (amount: number) =>
    setSelectedDate((current) => (view === 'month' ? addMonths(current, amount) : addDays(current, amount * 7)));

  const openEditor = (date: Date) => setEditor((current) => ({ key: current.key + 1, visible: true, date, lesson: null }));
  const openLesson = (lesson: ScheduleEntry) => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } });
  const closeEditor = () => setEditor((current) => ({ ...current, visible: false }));

  function startSavingTemplate() {
    if (!weekLessons.length) toast.show(t('errors.weekEmpty'));
    else setSavingTemplate(true);
  }

  function startApplyingTemplate() {
    if (!templates.length) toast.show(t('errors.templateMissing'));
    else setPickingTemplate(true);
  }

  function applyTemplate(template: ScheduleTemplate) {
    setPickingTemplate(false);
    feedback(actions.applyTemplate({ templateId: template.id, start: currentWeek }), t('schedule.templateApplied', { name: template.name }));
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <ScheduleHeader onAddLesson={() => openEditor(selectedDate)} />
        <PeriodNavigator
          label={view === 'week' ? weekLabel : formatDate(selectedDate, 'monthYear')}
          caption={view === 'week' && rotation ? t('today.week', { week: rotation }) : null}
          view={view}
          onPrevious={() => shiftPeriod(-1)}
          onNext={() => shiftPeriod(1)}
          onChangeView={setView}
        />
        <SummaryRow lessons={weekLessons.length} teachingDays={teachingDays} templates={templates.length} />
        {view === 'week'
          ? (
            <WeekView
              days={days}
              lessons={weekLessons}
              classById={classById}
              studentsByClass={studentsByClass}
              attendance={attendance}
              events={calendar.events}
              today={todayKey()}
              onOpenLesson={openLesson}
              onAddToDay={openEditor}
            />
          )
          : <MonthView lessons={monthLessons} classById={classById} onOpenLesson={openLesson} />}
        <View style={styles.actions}>
          <Button variant="secondary" label={t('schedule.saveTemplate')} onPress={startSavingTemplate} />
          <Button variant="secondary" label={t('schedule.applyTemplate')} onPress={startApplyingTemplate} />
        </View>
      </ScrollView>
      {!editor.visible && <Toast message={toast.message} />}

      <LessonEditorModal
        session={editor}
        onClose={closeEditor}
        onDone={({ message }) => toast.show(message)}
      />
      <PromptModal
        visible={savingTemplate}
        title={t('templates.saveTitle')}
        fields={[{ name: 'name', placeholder: t('templates.saveNamePlaceholder'), initialValue: t('templates.defaultName', { count: templates.length + 1 }) }]}
        onSubmit={({ name }) => {
          const result = actions.saveWeekAsTemplate({ start: currentWeek, name });
          if (!result.ok) return tError(result.error);
          toast.show(t('schedule.templateSaved'));
          return null;
        }}
        onClose={() => setSavingTemplate(false)}
      />
      <TemplatePickerModal
        visible={pickingTemplate}
        templates={templates}
        weekLabel={weekLabel}
        onPick={applyTemplate}
        onClose={() => setPickingTemplate(false)}
      />
    </SafeAreaView>
  );
}

const useStyles = createStyles((c) => ({
  safeArea: { flex: 1, backgroundColor: c.background },
  container: { padding: 20, paddingBottom: 40 },
  actions: { gap: 9, marginTop: 14 },
}));
