import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
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
import { EntryDraft, ScheduleEntry } from '../../../domain/types';
import { useActionFeedback } from '../../../hooks/useActionFeedback';
import { useToast } from '../../../hooks/useToast';
import { useI18n } from '../../../i18n/I18nProvider';
import { useClassById, useClasses, usePlannerActions } from '../../../state/planner';
import { createStyles } from '../../../theme/createStyles';
import { useSharedStyles } from '../../../theme/sharedStyles';
import { chooseScope } from '../chooseScope';
import ClassPicker from './ClassPicker';
import TimeRangeField from './TimeRangeField';

/** `key` changes on every open so the form state starts fresh. */
export type EditorSession = { key: number; visible: boolean; date: Date; lesson: ScheduleEntry | null };

export type EditorOutcome = { action: 'created' | 'updated' | 'deleted'; message: string; lessonId: string };

type Props = {
  session: EditorSession;
  onClose: () => void;
  /** Called after a successful save or delete. */
  onDone: (outcome: EditorOutcome) => void;
};

/**
 * Creates or edits a lesson's core details: subject, class, time, room and (for new
 * lessons) repetition. Attendance, plan, homework and notes live on the lesson page.
 */
export default function LessonEditorModal({ session, onClose, onDone }: Props) {
  const shared = useSharedStyles();
  const styles = useStyles();
  return (
    <Modal visible={session.visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={shared.modalBackdrop}>
        <View style={styles.card}>
          <EditorForm key={session.key} date={session.date} lesson={session.lesson} onClose={onClose} onDone={onDone} />
        </View>
      </View>
    </Modal>
  );
}

type FormState = Pick<EntryDraft, 'subject' | 'classId' | 'startTime' | 'endTime' | 'room'>;

const emptyForm: FormState = { subject: '', classId: '', startTime: '09:00', endTime: '10:00', room: '' };

type FormProps = Omit<Props, 'session'> & { date: Date; lesson: ScheduleEntry | null };

function EditorForm({ date, lesson, onClose, onDone }: FormProps) {
  const shared = useSharedStyles();
  const styles = useStyles();
  const { t, formatDate } = useI18n();
  const actions = usePlannerActions();
  const classes = useClasses();
  const classById = useClassById();
  const toast = useToast();
  const feedback = useActionFeedback(toast.show);

  const lessonDate = dateKey(date);
  const [form, setForm] = useState<FormState>(() => (lesson
    ? { subject: lesson.subject, classId: lesson.classId, startTime: lesson.startTime, endTime: lesson.endTime, room: lesson.room }
    : emptyForm));
  const [recurrence, setRecurrence] = useState<Recurrence>({ frequency: 'none', until: addDaysToKey(lessonDate, 7 * 12) });
  const set = <K extends keyof FormState>(field: K) => (value: FormState[K]) => setForm((current) => ({ ...current, [field]: value }));

  const selectedClass = form.classId ? classById.get(form.classId) : undefined;
  const repeating = lesson ? isRepeating(lesson) : false;

  async function save() {
    const scope = repeating ? await chooseScope(t, 'edit') : 'single';
    if (!scope) return;
    // Notes and plan are kept as they are; only the core details change here.
    const draft: EntryDraft = { ...lesson, ...form, id: lesson?.id ?? createId(), date: lessonDate };
    const result = actions.saveLesson({ draft, scope, recurrence: lesson ? NO_REPEAT : recurrence });
    if (!feedback(result)) return;
    onClose();
    const action = lesson ? 'updated' : 'created';
    onDone({ action, lessonId: draft.id, message: t(lesson ? 'editor.updated' : 'editor.created', { count: result.value.count }) });
  }

  async function remove() {
    if (!lesson) return;
    const scope = repeating ? await chooseScope(t, 'delete') : 'single';
    if (!scope) return;
    const result = actions.deleteLesson({ id: lesson.id, scope });
    if (!feedback(result)) return;
    onClose();
    onDone({ action: 'deleted', lessonId: lesson.id, message: t('editor.removed', { count: result.value.count }) });
  }

  function createClass(name: string) {
    const result = actions.addClass({ name });
    return feedback(result) ? result.value.id : null;
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
          <View style={shared.flex}>
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
  series: { color: c.primary, fontSize: 12, fontWeight: '700', marginTop: 6 },
  repeat: { marginBottom: 12 },
  until: { marginTop: 10 },
}));
