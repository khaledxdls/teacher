import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from '../../../components/feedback/Toast';
import { SavedClass } from '../../../domain/schedule';
import { useToast } from '../../../hooks/useToast';
import { ActionError } from '../../../hooks/usePlannerData';
import { colors } from '../../../theme/colors';
import { sharedStyles } from '../../../theme/sharedStyles';

type Props = {
  savedClass: SavedClass | null;
  onClose: () => void;
  onAddStudent: (classId: string, name: string) => ActionError;
  onRemoveStudent: (classId: string, studentId: string) => void;
};

/**
 * Must be rendered inside the editor's Modal: iOS cannot present two sibling
 * Modals at the same time, so a nested Modal is the only way to stack them.
 */
export default function StudentsModal({ savedClass, onClose, onAddStudent, onRemoveStudent }: Props) {
  const [name, setName] = useState('');
  const toast = useToast();

  function addStudent() {
    const trimmed = name.trim();
    if (!trimmed || !savedClass) {
      toast.show('Enter a student name first.');
      return;
    }
    const error = onAddStudent(savedClass.id, trimmed);
    if (error) toast.show(error);
    else setName('');
  }

  return (
    <Modal visible={savedClass !== null} animationType="fade" transparent onRequestClose={onClose}>
      <View style={sharedStyles.modalBackdrop}>
        <View style={styles.card}>
          <View style={sharedStyles.modalHeader}>
            <View>
              <Text style={sharedStyles.modalTitle}>Students</Text>
              <Text style={sharedStyles.modalSubtitle}>{savedClass?.name}</Text>
            </View>
            <Pressable style={sharedStyles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={sharedStyles.closeText}>×</Text>
            </Pressable>
          </View>
          <View style={sharedStyles.inlineAddRow}>
            <TextInput
              style={sharedStyles.inlineAddInput}
              placeholder="Student name"
              value={name}
              onChangeText={setName}
              onSubmitEditing={addStudent}
              returnKeyType="done"
            />
            <Pressable style={sharedStyles.inlineAddButton} onPress={addStudent} accessibilityRole="button">
              <Text style={sharedStyles.inlineAddText}>Add</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.list}>
            {savedClass?.students.map((student) => (
              <View key={student.id} style={styles.row}>
                <Text style={styles.name}>{student.name}</Text>
                <Pressable
                  onPress={() => onRemoveStudent(savedClass.id, student.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${student.name}`}
                >
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            ))}
            {!savedClass?.students.length && <Text style={sharedStyles.emptyText}>No students added yet.</Text>}
          </ScrollView>
          <Toast message={toast.message} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 430, maxHeight: '70%', backgroundColor: colors.surface, borderRadius: 24, padding: 24 },
  list: { marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.divider },
  name: { color: colors.navy, fontSize: 15, fontWeight: '600' },
  remove: { color: colors.danger, fontSize: 12, fontWeight: '700' },
});
