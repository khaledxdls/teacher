import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from '../../components/feedback/Toast';
import Button from '../../components/ui/Button';
import NamePromptModal from '../../components/ui/NamePromptModal';
import { addDays, addMonths, dateKey, displayDate, entriesInMonth, entriesInWeek, ScheduleEntry, ScheduleTemplate, weekDays, weekStart } from '../../domain/schedule';
import { useToast } from '../../hooks/useToast';
import { usePlanner } from '../../state/PlannerProvider';
import { colors } from '../../theme/colors';
import TemplatePickerModal from '../templates/TemplatePickerModal';
import ClassEditorModal, { EditorSession } from './components/ClassEditorModal';
import MonthView from './components/MonthView';
import PeriodNavigator, { ScheduleView } from './components/PeriodNavigator';
import ScheduleHeader from './components/ScheduleHeader';
import SummaryRow from './components/SummaryRow';
import WeekView from './components/WeekView';

export default function ScheduleScreen() {
  const planner = usePlanner();
  const router = useRouter();
  const toast = useToast();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<ScheduleView>('week');
  const [editor, setEditor] = useState<EditorSession>(() => ({ key: 0, visible: false, date: new Date(), entry: null }));
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [pickingTemplate, setPickingTemplate] = useState(false);

  const currentWeek = useMemo(() => weekStart(selectedDate), [selectedDate]);
  const days = useMemo(() => weekDays(currentWeek), [currentWeek]);
  const weekEntries = useMemo(() => entriesInWeek(planner.entries, currentWeek), [planner.entries, currentWeek]);
  const monthEntries = useMemo(() => entriesInMonth(planner.entries, selectedDate), [planner.entries, selectedDate]);
  const teachingDays = new Set(weekEntries.map((entry) => entry.date)).size;
  const todayKey = dateKey(new Date());
  const weekLabel = `${displayDate(days[0])} – ${displayDate(days[6])}`;

  const periodLabel = view === 'week'
    ? weekLabel
    : selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const shiftPeriod = (amount: number) =>
    setSelectedDate((current) => (view === 'month' ? addMonths(current, amount) : addDays(current, amount * 7)));

  const openEditor = (date: Date, entry: ScheduleEntry | null = null) =>
    setEditor((current) => ({ key: current.key + 1, visible: true, date, entry }));
  const closeEditor = () => setEditor((current) => ({ ...current, visible: false }));

  function startSavingTemplate() {
    if (!weekEntries.length) {
      toast.show('Add a class before saving a template.');
      return;
    }
    setSavingTemplate(true);
  }

  function startApplyingTemplate() {
    if (!planner.templates.length) {
      toast.show('Save a week as a template first.');
      return;
    }
    setPickingTemplate(true);
  }

  function applyTemplate(template: ScheduleTemplate) {
    setPickingTemplate(false);
    const error = planner.applyTemplate(template.id, currentWeek);
    toast.show(error ?? `"${template.name}" applied to this week.`);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
          ? <WeekView days={days} entries={weekEntries} classById={planner.classById} todayKey={todayKey} onOpenEntry={openEditor} onAddToDay={openEditor} />
          : <MonthView entries={monthEntries} classById={planner.classById} onOpenEntry={openEditor} />}
        <View style={styles.actions}>
          <Button variant="secondary" label="Save week as template" onPress={startSavingTemplate} />
          <Button variant="secondary" label="Apply a template" onPress={startApplyingTemplate} />
        </View>
      </ScrollView>
      {!editor.visible && <Toast message={toast.message} />}

      <ClassEditorModal
        session={editor}
        onClose={closeEditor}
        onManageStudents={(classId) => router.push({ pathname: '/class/[id]', params: { id: classId } })}
      />
      <NamePromptModal
        visible={savingTemplate}
        title="Save week as template"
        placeholder="Template name, e.g. Week A"
        initialValue={`Week template ${planner.templates.length + 1}`}
        onSubmit={(name) => {
          const error = planner.saveWeekAsTemplate(currentWeek, name);
          if (!error) toast.show('Week template saved.');
          return error;
        }}
        onClose={() => setSavingTemplate(false)}
      />
      <TemplatePickerModal
        visible={pickingTemplate}
        templates={planner.templates}
        weekLabel={weekLabel}
        onPick={applyTemplate}
        onClose={() => setPickingTemplate(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 40 },
  actions: { gap: 9, marginTop: 14 },
});
