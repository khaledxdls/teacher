import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from '../../../components/feedback/Toast';
import Button from '../../../components/ui/Button';
import { AttendanceStatus, createId, dateKey, displayDate, EntryDraft, ScheduleEntry, timeToMinutes } from '../../../domain/schedule';
import { useToast } from '../../../hooks/useToast';
import { usePlanner } from '../../../state/PlannerProvider';
import { colors } from '../../../theme/colors';
import { sharedStyles } from '../../../theme/sharedStyles';
import AttendanceList from './AttendanceList';
import ClassPicker from './ClassPicker';
import TimeRangeField from './TimeRangeField';

/** `key` changes on every open so the form state starts fresh. */
export type EditorSession = { key: number; visible: boolean; date: Date; entry: ScheduleEntry | null };

type Props = {
  session: EditorSession;
  onClose: () => void;
  /** Called when the user wants to edit the students of a class (the editor closes first). */
  onManageStudents: (classId: string) => void;
};

export default function ClassEditorModal({ session, onClose, onManageStudents }: Props) {
  return (
    <Modal visible={session.visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sharedStyles.modalBackdrop}>
        <View style={styles.card}>
          <EditorForm key={session.key} date={session.date} entry={session.entry} onClose={onClose} onManageStudents={onManageStudents} />
        </View>
      </View>
    </Modal>
  );
}

type FormProps = Omit<Props, 'session'> & { date: Date; entry: ScheduleEntry | null };

type FormState = {
  subject: string;
  classId: string;
  startTime: string;
  endTime: string;
  room: string;
  notes: string;
  attendance: Record<string, AttendanceStatus>;
};

const emptyForm: FormState = { subject: '', classId: '', startTime: '09:00', endTime: '10:00', room: '', notes: '', attendance: {} };

function EditorForm({ date, entry, onClose, onManageStudents }: FormProps) {
  const planner = usePlanner();
  const [form, setForm] = useState<FormState>(() => (entry
    ? {
      subject: entry.subject, classId: entry.classId, startTime: entry.startTime, endTime: entry.endTime,
      room: entry.room, notes: entry.notes ?? '', attendance: entry.attendance ?? {},
    }
    : emptyForm));
  const toast = useToast();

  const selectedClass = form.classId ? planner.classById.get(form.classId) : undefined;
  const setField = <K extends keyof FormState>(field: K) => (value: FormState[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  function save() {
    if (!form.subject.trim() || !form.classId) {
      toast.show('Add a subject and choose a class first.');
      return;
    }
    if (timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) {
      toast.show('The end time must be after the start time.');
      return;
    }
    // Only keep attendance for students who are still in the selected class.
    const studentIds = new Set(selectedClass?.students.map((student) => student.id));
    const attendance = Object.fromEntries(Object.entries(form.attendance).filter(([id]) => studentIds.has(id)));
    const draft: EntryDraft = {
      id: entry?.id ?? createId(),
      date: dateKey(date),
      subject: form.subject.trim(),
      classId: form.classId,
      startTime: form.startTime,
      endTime: form.endTime,
      room: form.room.trim(),
      notes: form.notes.trim(),
      attendance,
    };
    const error = planner.saveEntry(draft);
    if (error) toast.show(error);
    else onClose();
  }

  function remove() {
    if (!entry) return;
    planner.deleteEntry(entry.id);
    onClose();
  }

  function manageStudents() {
    if (!selectedClass) {
      toast.show('Select a class first.');
      return;
    }
    onClose();
    onManageStudents(selectedClass.id);
  }

  const students = selectedClass?.students ?? [];

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={sharedStyles.modalHeader}>
          <View>
            <Text style={sharedStyles.modalTitle}>{entry ? 'Edit class' : 'Add class'}</Text>
            <Text style={sharedStyles.modalSubtitle}>{displayDate(date)}</Text>
          </View>
          <Pressable style={sharedStyles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={sharedStyles.closeText}>×</Text>
          </Pressable>
        </View>

        <Text style={sharedStyles.fieldLabel}>Class details</Text>
        <TextInput style={sharedStyles.input} placeholder="Subject" value={form.subject} onChangeText={setField('subject')} />

        <Text style={sharedStyles.fieldLabel}>Class</Text>
        <ClassPicker
          classes={planner.classes}
          value={form.classId}
          selectedName={selectedClass ? `${selectedClass.name}${selectedClass.deleted ? ' (deleted)' : ''}` : undefined}
          onSelect={setField('classId')}
          onAddClass={planner.addClass}
          onError={toast.show}
        />

        <Text style={sharedStyles.fieldLabel}>Class time</Text>
        <TimeRangeField
          startTime={form.startTime}
          endTime={form.endTime}
          onChange={(range) => setForm((current) => ({ ...current, ...range }))}
        />

        <TextInput style={sharedStyles.input} placeholder="Room (optional)" value={form.room} onChangeText={setField('room')} />

        <View style={styles.notesHeader}>
          <Text style={sharedStyles.fieldLabel}>After-class notes</Text>
          <Text style={styles.notesHint}>Homework, questions, follow-ups</Text>
        </View>
        <TextInput
          style={[sharedStyles.input, styles.notesInput]}
          placeholder="What should you remember?"
          value={form.notes}
          onChangeText={setField('notes')}
          multiline
          textAlignVertical="top"
        />

        {students.length > 0 && (
          <AttendanceList students={students} attendance={form.attendance} onChange={setField('attendance')} />
        )}

        <Button
          variant="outline"
          style={styles.manageStudents}
          onPress={manageStudents}
          label={selectedClass ? `Manage students (${students.length})` : 'Select a class to manage students'}
        />

        <Button label={entry ? 'Save changes' : 'Add class'} onPress={save} />
        {entry && <Button label="Delete class" variant="danger" onPress={remove} />}
        <Button label="Cancel" variant="text" onPress={onClose} />
      </ScrollView>

      <Toast message={toast.message} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 430, maxHeight: '86%', backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden', shadowColor: colors.navy, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8 },
  content: { padding: 24, paddingBottom: 18 },
  notesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notesHint: { color: colors.textFaint, fontSize: 11, marginBottom: 7 },
  notesInput: { minHeight: 76 },
  manageStudents: { marginBottom: 12 },
});
