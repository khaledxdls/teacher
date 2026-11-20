import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useI18n } from '../../i18n/I18nProvider';
import { useSharedStyles } from '../../theme/sharedStyles';
import Toast from '../feedback/Toast';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  toastMessage?: string | null;
};

/**
 * A centered modal card with a title and close button. Content is mounted only while
 * visible, so forms inside start fresh every time they open.
 */
export default function FormModal({ visible, title, subtitle, onClose, children, toastMessage = null }: Props) {
  const shared = useSharedStyles();
  const { t } = useI18n();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={shared.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {visible && (
          <View style={shared.modalCard}>
            <View style={shared.modalHeader}>
              <View style={shared.flex}>
                <Text style={shared.modalTitle} accessibilityRole="header">{title}</Text>
                {subtitle ? <Text style={shared.modalSubtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable style={shared.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')}>
                <Text style={shared.closeText}>×</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
            <Toast message={toastMessage} />
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
