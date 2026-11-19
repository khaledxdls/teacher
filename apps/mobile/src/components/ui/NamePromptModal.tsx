import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from '../feedback/Toast';
import { useToast } from '../../hooks/useToast';
import { colors } from '../../theme/colors';
import { sharedStyles } from '../../theme/sharedStyles';
import Button from './Button';

type Props = {
  visible: boolean;
  title: string;
  placeholder: string;
  initialValue?: string;
  confirmLabel?: string;
  /** Returns an error message to keep the dialog open, or null to close it. */
  onSubmit: (value: string) => string | null;
  onClose: () => void;
};

/** Cross-platform text prompt (Alert.prompt only exists on iOS). */
export default function NamePromptModal(props: Props) {
  return (
    <Modal visible={props.visible} animationType="fade" transparent onRequestClose={props.onClose}>
      <KeyboardAvoidingView style={sharedStyles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Mounted only while open, so every opening starts from `initialValue`. */}
        {props.visible && <PromptForm {...props} />}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PromptForm({ title, placeholder, initialValue = '', confirmLabel = 'Save', onSubmit, onClose }: Props) {
  const [value, setValue] = useState(initialValue);
  const toast = useToast();

  function submit() {
    const error = onSubmit(value);
    if (error) toast.show(error);
    else onClose();
  }

  return (
    <View style={styles.card}>
      <View style={sharedStyles.modalHeader}>
        <Text style={sharedStyles.modalTitle}>{title}</Text>
        <Pressable style={sharedStyles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={sharedStyles.closeText}>×</Text>
        </Pressable>
      </View>
      <TextInput
        style={sharedStyles.input}
        placeholder={placeholder}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        returnKeyType="done"
        autoFocus
      />
      <Button label={confirmLabel} onPress={submit} />
      <Button label="Cancel" variant="text" onPress={onClose} />
      <Toast message={toast.message} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 430, backgroundColor: colors.surface, borderRadius: 24, padding: 24 },
});
