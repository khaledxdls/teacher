import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from '../../components/feedback/Toast';
import { addDays, addMonths, dateKey, displayDate, entriesInMonth, entriesInWeek, ScheduleEntry, weekDays, weekStart } from '../../domain/schedule';
import { ActionError, usePlannerData } from '../../hooks/usePlannerData';
import { useToast } from '../../hooks/useToast';
import { colors } from '../../theme/colors';
import ClassEditorModal, { EditorSession } from './components/ClassEditorModal';
import MonthView from './components/MonthView';
import PeriodNavigator, { ScheduleView } from './components/PeriodNavigator';
import PlannerActions from './components/PlannerActions';
import ScheduleHeader from './components/ScheduleHeader';
import SummaryRow from './components/SummaryRow';
import WeekView from './components/WeekView';

export default function ScheduleScreen() {
  const planner = usePlannerData();
  const toast = useToast();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<ScheduleView>('week');
  const [editor, setEditor] = useState<EditorSession>(() => ({ key: 0, visible: false, date: new Date(), entry: null }));

  const currentWeek = useMemo(() => weekStart(selectedDate), [selectedDate]);
  const days = useMemo(() => weekDays(currentWeek), [currentWeek]);
  const weekEntries = useMemo(() => entriesInWeek(planner.entries, currentWeek), [planner.entries, currentWeek]);
  const monthEntries = useMemo(() => entriesInMonth(planner.entries, selectedDate), [planner.entries, selectedDate]);
  const teachingDays = new Set(weekEntries.map((entry) => entry.date)).size;
  const todayKey = dateKey(new Date());

  const periodLabel = view === 'week'
    ? `${displayDate(days[0])} – ${displayDate(days[6])}`
    : selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const shiftPeriod = (amount: number) =>
    setSelectedDate((current) => (view === 'month' ? addMonths(current, amount) : addDays(current, amount * 7)));

  const openEditor = (date: Date, entry: ScheduleEntry | null = null) =>
    setEditor((current) => ({ key: current.key + 1, visible: true, date, entry }));
  const closeEditor = () => setEditor((current) => ({ ...current, visible: false }));

  const report = (error: ActionError, success?: string) => {
    if (error) toast.show(error);
    else if (success) toast.show(success);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <ScheduleHeader onAddClass={() => openEditor(selectedDate)} />
        <PeriodNavigator
          label={periodLabel}
          view={view}
          onPrevious={() => shiftPeriod(-1)}
          onNext={() => shiftPeriod(1)}
          onChangeView={setView}
        />
        <SummaryRow classes={weekEntries.length} teachingDays={teachingDays} templates={planner.templates.length} />
        {view === 'week'
          ? <WeekView days={days} entries={weekEntries} todayKey={todayKey} onOpenEntry={openEditor} onAddToDay={openEditor} />
          : <MonthView entries={monthEntries} onOpenEntry={openEditor} />}
        <PlannerActions
          weeklyReminder={planner.weeklyReminder}
          onChangeWeeklyReminder={planner.setWeeklyReminder}
          onSaveTemplate={() => report(planner.saveWeekAsTemplate(currentWeek), 'Week template saved.')}
          onApplyTemplate={() => report(planner.applyLatestTemplate(currentWeek), 'Template applied to this week.')}
        />
      </ScrollView>
      {!editor.visible && <Toast message={toast.message} />}
      <ClassEditorModal
        session={editor}
        classes={planner.classes}
        onClose={closeEditor}
        onSave={planner.saveEntry}
        onDelete={planner.deleteEntry}
        onAddClass={planner.addClass}
        onAddStudent={planner.addStudent}
        onRemoveStudent={planner.removeStudent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 40 },
});
