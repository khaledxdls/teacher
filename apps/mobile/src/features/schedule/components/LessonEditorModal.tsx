import { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Toast from '../../../components/feedback/Toast';
import Button from '../../../components/ui/Button';
import DateTimeInput from '../../../components/ui/DateTimeInput';
import LabeledField from '../../../components/ui/LabeledField';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import TextField from '../../../components/ui/TextField';
import { NO_REPEAT } from '../../../domain/commands';
import { addDaysToKey, dateKey } from '../../../domain/dates';
import { isRepeating, Recurrence, RepeatFrequency } from '../../../domain/recurrence';
import { createId } from '../../../domain/records';
import { AttendanceStatus, EntryDraft, ScheduleEntry } from '../../../domain/types';
import { useActionFeedback } from '../../../hooks/useActionFeedback';
import { useToast } from '../../../hooks/useToast';
import { useI18n } from '../../../i18n/I18nProvider';
import { useClassById, useClasses, usePlannerActions } from '../../../state/planner';
import { createStyles } from '../../../theme/createStyles';
import { useTheme } from '../../../theme/ThemeProvider';
import { useSharedStyles } from '../../../theme/sharedStyles';
import { chooseScope } from '../chooseScope';
import AttendanceList from './AttendanceList';
import ClassPicker from './ClassPicker';
import TimeRangeField from './TimeRangeField';

/** `key` changes on every open so the form state starts fresh. */
export type EditorSession = { key: number; visible: boolean; date: Date; lesson: ScheduleEntry | null };

type Props = {
  session: EditorSession;
  onClose: () => void;
  /** Called with a confirmation message after a successful save or delete. */
  onDone: (message: string) => void;
  /** Called when the user wants to edit the students of a class (the editor closes first). */
  onManageStudents: (classId: string) => void;
};

export default function LessonEditorModal({ session, onClose, onDone, onManageStudents }: Props) {
  const shared = useSharedStyles();
  const styles = useStyles();
  return (
    <Modal visible={session.visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={shared.modalBackdrop}>
        <View style={styles.card}>
          <EditorForm key={session.key} date={session.date} lesson={session.lesson} onClose={onClose} onDone={onDone} onManageStudents={onManageStudents} />
        </View>
      </View>
    </Modal>
  );
}

type FormState = Omit<EntryDraft, 'id' | 'date' | 'seriesId'> & { notes: string; attendance: Record<string, AttendanceStatus> };

const emptyForm: FormState = { subject: '', classId: '', startTime: '09:00', endTime: '10:00', room: '', notes: '', notesDone: false, attendance: {} };

const formFromLesson = (lesson: ScheduleEntry): FormState => ({
  subject: lesson.subject,
  classId: lesson.classId,
  startTime: lesson.startTime,
  endTime: lesson.endTime,
  room: lesson.room,
  notes: lesson.notes ?? '',
  notesDone: lesson.notesDone ?? false,
  attendance: lesson.attendance ?? {},
});

type FormProps = Omit<Props, 'session'> & { date: Date; lesson: ScheduleEntry | null };

function EditorForm({ date, lesson, onClose, onDone, onManageStudents }: FormProps) {
  const shared = useSharedStyles();
  const styles = useStyles();
  const { palette } = useTheme();
  const { t, formatDate } = useI18n();
  const actions = usePlannerActions();
  const classes = useClasses();
  const classById = useClassById();
  const toast = useToast();
  const feedback = useActionFeedback(toast.show);

  const lessonDate = dateKey(date);
  const [form, setForm] = useState<FormState>(() => (lesson ? formFromLesson(lesson) : emptyForm));
  const [recurrence, setRecurrence] = useState<Recurrence>({ frequency: 'none', until: addDaysToKey(lessonDate, 7 * 12) });
  const set = <K extends keyof FormState>(field: K) => (value: FormState[K]) => setForm((current) => ({ ...current, [field]: value }));

  const selectedClass = form.classId ? classById.get(form.classId) : undefined;
  const students = selectedClass?.students ?? [];
  const repeating = lesson ? isRepeating(lesson) : false;

  function buildDraft(): EntryDraft {
    // Only keep attendance for students who are still in the selected class.
    const studentIds = new Set(students.map((student) => student.id));
    return {
      ...form,
      id: lesson?.id ?? createId(),
      date: lessonDate,
      seriesId: lesson?.seriesId,
      attendance: Object.fromEntries(Object.entries(form.attendance).filter(([id]) => studentIds.has(id))),
    };
  }

  async function save() {
    const scope = repeating ? await chooseScope(t, 'edit') : 'single';
    if (!scope) return;
    const result = actions.saveLesson({ draft: buildDraft(), scope, recurrence: lesson ? NO_REPEAT : recurrence });
    if (!feedback(result)) return;
    onClose();
    onDone(t(lesson ? 'editor.updated' : 'editor.created', { count: result.value.count }));
  }

  async function remove() {
    if (!lesson) return;
    const scope = repeating ? await chooseScope(t, 'delete') : 'single';
    if (!scope) return;
    const result = actions.deleteLesson({ id: lesson.id, scope });
    if (!feedback(result)) return;
    onClose();
    onDone(t('editor.removed', { count: result.value.count }));
  }

  function createClass(name: string) {
    const result = actions.addClass({ name });
    return feedback(result) ? result.value.id : null;
  }

  function manageStudents() {
    if (!selectedClass) return;
    onClose();
    onManageStudents(selectedClass.id);
  }

  const repeatOptions: { value: RepeatFrequency; label: string }[] = [
    { value: 'none', label: t('editor.repeatNone') },
    { value: 'weekly', label: t('editor.repeatWeekly') },
    { value: 'biweekly', label: t('editor.repeatBiweekly') },
  ];

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={shared.modalHeader}>
          <View style={styles.headerText}>
            <Text style={shared.modalTitle} accessibilityRole="header">{t(lesson ? 'editor.editTitle' : 'editor.addTitle')}</Text>
            <Text style={shared.modalSubtitle}>{formatDate(date, 'full')}</Text>
            {repeating && <Text style={styles.series}>↻ {t('editor.partOfSeries')}</Text>}
          </View>
          <Pressable style={shared.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <Text style={shared.closeText}>×</Text>
          </Pressable>
        </View>

        <TextField label={t('editor.details')} placeholder={t('editor.subject')} value={form.subject} onChangeText={set('subject')} />

        <Text style={shared.fieldLabel}>{t('editor.class')}</Text>
        <ClassPicker
          classes={classes}
          value={form.classId}
          selectedName={selectedClass && (selectedClass.deleted ? t('editor.deletedClass', { name: selectedClass.name }) : selectedClass.name)}
          onSelect={set('classId')}
          onCreate={createClass}
        />

        <Text style={shared.fieldLabel}>{t('editor.time')}</Text>
        <TimeRangeField startTime={form.startTime} endTime={form.endTime} onChange={(range) => setForm((current) => ({ ...current, ...range }))} />

        <TextField placeholder={t('editor.room')} value={form.room} onChangeText={set('room')} />

        {!lesson && (
          <View style={styles.repeat}>
            <Text style={shared.fieldLabel}>{t('editor.repeat')}</Text>
            <SegmentedControl
              options={repeatOptions}
              value={recurrence.frequency}
              onChange={(frequency) => setRecurrence((current) => ({ ...current, frequency }))}
            />
            {recurrence.frequency !== 'none' && (
              <View style={styles.until}>
                <LabeledField label={t('editor.repeatUntil')} inline>
                  <DateTimeInput
                    mode="date"
                    value={recurrence.until}
                    minimumDate={lessonDate}
                    onChange={(until) => setRecurrence((current) => ({ ...current, until }))}
                    accessibilityLabel={t('editor.repeatUntil')}
                  />
                </LabeledField>
              </View>
            )}
          </View>
        )}

        <View style={styles.notesHeader}>
          <Text style={shared.fieldLabel}>{t('editor.notes')}</Text>
          <Text style={styles.notesHint}>{t('editor.notesHint')}</Text>
        </View>
        <TextField
          style={styles.notesInput}
          placeholder={t('editor.notesPlaceholder')}
          value={form.notes}
          onChangeText={set('notes')}
          multiline
          textAlignVertical="top"
        />
        {lesson && form.notes.trim() !== '' && (
          <LabeledField label={t('editor.notesDone')} inline>
            <Switch value={Boolean(form.notesDone)} onValueChange={set('notesDone')} trackColor={{ true: palette.primary }} />
          </LabeledField>
        )}

        {students.length > 0 && <AttendanceList students={students} attendance={form.attendance} onChange={set('attendance')} />}

        <Button
          variant="outline"
          style={styles.spaced}
          onPress={manageStudents}
          disabled={!selectedClass}
          label={selectedClass ? t('editor.manageStudents', { count: students.length }) : t('editor.selectClassForStudents')}
        />
        <Button label={t(lesson ? 'editor.saveChanges' : 'editor.add')} onPress={() => void save()} />
        {lesson && <Button label={t('editor.delete')} variant="danger" onPress={() => void remove()} />}
        <Button label={t('common.cancel')} variant="text" onPress={onClose} />
      </ScrollView>
      <Toast message={toast.message} />
    </>
  );
}

const useStyles = createStyles((c) => ({
  card: { width: '100%', maxWidth: 460, maxHeight: '90%', backgroundColor: c.surface, borderRadius: 24, overflow: 'hidden', shadowColor: c.shadow, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8 },
  content: { padding: 24, paddingBottom: 18 },
  headerText: { flex: 1 },
  series: { color: c.primary, fontSize: 12, fontWeight: '700', marginTop: 6 },
  repeat: { marginBottom: 12 },
  until: { marginTop: 10 },
  notesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  notesHint: { color: c.textFaint, fontSize: 11, marginBottom: 7 },
  notesInput: { minHeight: 76 },
  spaced: { marginBottom: 12 },
}));
