import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Button from '../../components/ui/Button';
import { confirmDestructive } from '../../components/ui/confirm';
import NamePromptModal from '../../components/ui/NamePromptModal';
import Screen from '../../components/ui/Screen';
import { Student, studentAttendanceStats } from '../../domain/schedule';
import { useToast } from '../../hooks/useToast';
import { usePlanner } from '../../state/PlannerProvider';
import { colors } from '../../theme/colors';
import { sharedStyles } from '../../theme/sharedStyles';

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const planner = usePlanner();
  const router = useRouter();
  const toast = useToast();
  const [studentName, setStudentName] = useState('');
  const [renaming, setRenaming] = useState(false);

  const savedClass = id ? planner.classById.get(id) : undefined;
  const stats = useMemo(() => (id ? studentAttendanceStats(planner.entries, id) : new Map()), [planner.entries, id]);

  if (!savedClass || savedClass.deleted) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Class' }} />
        <Text style={sharedStyles.emptyText}>{planner.hydrated ? 'This class no longer exists.' : 'Loading…'}</Text>
      </Screen>
    );
  }

  function addStudent() {
    const error = planner.addStudent(savedClass!.id, studentName);
    if (error) toast.show(error);
    else setStudentName('');
  }

  function removeStudent(student: Student) {
    confirmDestructive('Remove student?', `${student.name} will be removed from ${savedClass!.name}.`, 'Remove', () =>
      planner.removeStudent(savedClass!.id, student.id));
  }

  function deleteClass() {
    confirmDestructive('Delete class?', `${savedClass!.name} and its student list will be deleted.`, 'Delete', () => {
      const error = planner.deleteClass(savedClass!.id);
      if (error) toast.show(error);
      else router.back();
    });
  }

  return (
    <Screen toastMessage={toast.message}>
      <Stack.Screen options={{ title: savedClass.name }} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Students ({savedClass.students.length})</Text>
        <View style={[sharedStyles.inlineAddRow, styles.addRow]}>
          <TextInput
            style={sharedStyles.inlineAddInput}
            placeholder="Student name"
            value={studentName}
            onChangeText={setStudentName}
            onSubmitEditing={addStudent}
            returnKeyType="done"
          />
          <Pressable style={sharedStyles.inlineAddButton} onPress={addStudent} accessibilityRole="button">
            <Text style={sharedStyles.inlineAddText}>Add</Text>
          </Pressable>
        </View>
        {savedClass.students.map((student) => {
          const record = stats.get(student.id);
          const rate = record?.marked ? Math.round(((record.present + record.late) / record.marked) * 100) : null;
          return (
            <View key={student.id} style={styles.studentRow}>
              <View style={styles.studentText}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentMeta}>
                  {record
                    ? `${rate}% attendance · ${record.present} present, ${record.late} late, ${record.absent} absent`
                    : 'No attendance recorded yet'}
                </Text>
              </View>
              <Pressable onPress={() => removeStudent(student)} accessibilityRole="button" accessibilityLabel={`Remove ${student.name}`} hitSlop={8}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          );
        })}
        {savedClass.students.length === 0 && <Text style={sharedStyles.emptyText}>No students added yet.</Text>}
      </View>

      <Button label="Rename class" variant="secondary" onPress={() => setRenaming(true)} />
      <Button label="Delete class" variant="danger" onPress={deleteClass} />

      <NamePromptModal
        visible={renaming}
        title="Rename class"
        placeholder="Class name"
        initialValue={savedClass.name}
        onSubmit={(name) => planner.renameClass(savedClass.id, name)}
        onClose={() => setRenaming(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.divider },
  sectionTitle: { color: colors.navy, fontWeight: '800', fontSize: 16, padding: 16, paddingBottom: 10 },
  addRow: { marginHorizontal: 0 },
  studentRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  studentText: { flex: 1, marginRight: 12 },
  studentName: { color: colors.navy, fontSize: 15, fontWeight: '600' },
  studentMeta: { color: colors.textSubtle, fontSize: 12, marginTop: 3 },
  remove: { color: colors.danger, fontSize: 12, fontWeight: '700' },
});
