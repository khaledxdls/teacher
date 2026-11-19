import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from '../../../components/feedback/Toast';
import { createId, dateKey, displayDate, sameName, SavedClass, ScheduleEntry, timeToMinutes } from '../../../domain/schedule';
import { ActionError } from '../../../hooks/usePlannerData';
import { useToast } from '../../../hooks/useToast';
import { colors } from '../../../theme/colors';
import { sharedStyles } from '../../../theme/sharedStyles';
import ClassPicker from './ClassPicker';
import StudentsModal from './StudentsModal';
import TimeRangeField from './TimeRangeField';

/** `key` changes on every open so the form state starts fresh. */
export type EditorSession = { key: number; visible: boolean; date: Date; entry: ScheduleEntry | null };

type Props = {
  session: EditorSession;
  classes: SavedClass[];
  onClose: () => void;
  onSave: (entry: ScheduleEntry) => ActionError;
  onDelete: (id: string) => void;
  onAddClass: (name: string) => SavedClass;
  onAddStudent: (classId: string, name: string) => ActionError;
  onRemoveStudent: (classId: string, studentId: string) => void;
};

export default function ClassEditorModal({ session, onClose, ...formProps }: Props) {
  return (
    <Modal visible={session.visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sharedStyles.modalBackdrop}>
        <View style={styles.card}>
          <EditorForm key={session.key} date={session.date} entry={session.entry} onClose={onClose} {...formProps} />
        </View>
      </View>
    </Modal>
  );
}

type FormProps = Omit<Props, 'session'> & { date: Date; entry: ScheduleEntry | null };

const emptyForm = { subject: '', className: '', startTime: '09:00', endTime: '10:00', room: '', notes: '' };

function EditorForm({ date, entry, classes, onClose, onSave, onDelete, onAddClass, onAddStudent, onRemoveStudent }: FormProps) {
  const [form, setForm] = useState(() => (entry
    ? { subject: entry.subject, className: entry.className, startTime: entry.startTime, endTime: entry.endTime, room: entry.room, notes: entry.notes ?? '' }
    : emptyForm));
  const [studentClassId, setStudentClassId] = useState<string | null>(null);
  const toast = useToast();

  const selectedClass = classes.find((item) => sameName(item.name, form.className));
  const studentClass = classes.find((item) => item.id === studentClassId) ?? null;
  const setField = <K extends keyof typeof form>(field: K) => (value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  function save() {
    if (!form.subject.trim() || !form.className.trim()) {
      toast.show('Add a subject and class name first.');
      return;
    }
    if (timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) {
      toast.show('The end time must be after the start time.');
      return;
    }
    const error = onSave({
      ...form,
      subject: form.subject.trim(),
      className: form.className.trim(),
      room: form.room.trim(),
      notes: form.notes.trim(),
      date: dateKey(date),
      id: entry?.id ?? createId(),
    });
    if (error) toast.show(error);
    else onClose();
  }

  function remove() {
    if (!entry) return;
    onDelete(entry.id);
    onClose();
  }

  function openStudents() {
    if (!selectedClass) {
      toast.show('Select a saved class first.');
      return;
    }
    setStudentClassId(selectedClass.id);
  }

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
          classes={classes}
          value={form.className}
          onSelect={setField('className')}
          onAddClass={onAddClass}
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

        <Pressable style={styles.manageStudentsButton} onPress={openStudents} accessibilityRole="button">
          <Text style={styles.manageStudentsText}>
            {selectedClass ? `Manage students (${selectedClass.students.length})` : 'Select a class to manage students'}
          </Text>
        </Pressable>

        <Pressable style={styles.primaryButton} onPress={save} accessibilityRole="button">
          <Text style={styles.primaryText}>{entry ? 'Save changes' : 'Add class'}</Text>
        </Pressable>
        {entry && (
          <Pressable onPress={remove} style={styles.textButton} accessibilityRole="button">
            <Text style={styles.deleteText}>Delete class</Text>
          </Pressable>
        )}
        <Pressable onPress={onClose} style={styles.textButton} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>

      <Toast message={toast.message} />

      <StudentsModal
        savedClass={studentClass}
        onClose={() => setStudentClassId(null)}
        onAddStudent={onAddStudent}
        onRemoveStudent={onRemoveStudent}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 430, maxHeight: '86%', backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden', shadowColor: colors.navy, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8 },
  content: { padding: 24, paddingBottom: 18 },
  notesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notesHint: { color: colors.textFaint, fontSize: 11, marginBottom: 7 },
  notesInput: { minHeight: 76 },
  manageStudentsButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 13, alignItems: 'center', marginBottom: 12 },
  manageStudentsText: { color: colors.primary, fontWeight: '800' },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 10, padding: 15, alignItems: 'center' },
  primaryText: { color: colors.surface, fontWeight: '800' },
  textButton: { padding: 14, alignItems: 'center' },
  cancelText: { color: colors.textMuted, fontWeight: '700' },
  deleteText: { color: colors.danger, fontWeight: '800' },
});
