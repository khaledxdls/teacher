import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/ui/Button';
import { ScheduleTemplate } from '../../domain/schedule';
import { colors } from '../../theme/colors';
import { sharedStyles } from '../../theme/sharedStyles';

type Props = {
  visible: boolean;
  templates: ScheduleTemplate[];
  weekLabel: string;
  onPick: (template: ScheduleTemplate) => void;
  onClose: () => void;
};

export default function TemplatePickerModal({ visible, templates, weekLabel, onPick, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={sharedStyles.modalBackdrop}>
        <View style={styles.card}>
          <View style={sharedStyles.modalHeader}>
            <View style={styles.headerText}>
              <Text style={sharedStyles.modalTitle}>Apply a template</Text>
              <Text style={sharedStyles.modalSubtitle}>{weekLabel}</Text>
            </View>
            <Pressable style={sharedStyles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={sharedStyles.closeText}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.warning}>Classes already planned on the template&apos;s days will be replaced.</Text>
          <ScrollView style={styles.list}>
            {templates.map((template) => (
              <Pressable key={template.id} style={styles.row} onPress={() => onPick(template)} accessibilityRole="button">
                <Text style={styles.name}>{template.name}</Text>
                <Text style={styles.meta}>{template.entries.length} class{template.entries.length === 1 ? '' : 'es'}</Text>
              </Pressable>
            ))}
            {templates.length === 0 && <Text style={sharedStyles.emptyText}>Save a week as a template first.</Text>}
          </ScrollView>
          <Button label="Cancel" variant="text" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 430, maxHeight: '75%', backgroundColor: colors.surface, borderRadius: 24, padding: 24 },
  headerText: { flex: 1 },
  warning: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  list: { marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  name: { color: colors.navy, fontSize: 15, fontWeight: '700', flex: 1 },
  meta: { color: colors.textSubtle, fontSize: 12 },
});
