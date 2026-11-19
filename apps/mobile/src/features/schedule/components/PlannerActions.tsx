import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors } from '../../../theme/colors';

type Props = {
  weeklyReminder: boolean;
  onChangeWeeklyReminder: (enabled: boolean) => void;
  onSaveTemplate: () => void;
  onApplyTemplate: () => void;
};

export default function PlannerActions({ weeklyReminder, onChangeWeeklyReminder, onSaveTemplate, onApplyTemplate }: Props) {
  return (
    <>
      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={onSaveTemplate} accessibilityRole="button">
          <Text style={styles.secondaryText}>Save week as template</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onApplyTemplate} accessibilityRole="button">
          <Text style={styles.secondaryText}>Apply latest template</Text>
        </Pressable>
      </View>
      <View style={styles.notificationCard}>
        <View style={styles.notificationBody}>
          <Text style={styles.notificationTitle}>Friday planning reminder</Text>
          <Text style={styles.notificationText}>Every Friday at 8:00 AM</Text>
        </View>
        <Switch
          value={weeklyReminder}
          onValueChange={onChangeWeeklyReminder}
          trackColor={{ true: colors.primary }}
          accessibilityLabel="Friday planning reminder"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 9, marginTop: 14 },
  secondaryButton: { backgroundColor: colors.primarySoft, padding: 14, borderRadius: 11, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontWeight: '800' },
  notificationCard: { marginTop: 18, backgroundColor: colors.surface, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center' },
  notificationBody: { flex: 1 },
  notificationTitle: { color: colors.navy, fontWeight: '800' },
  notificationText: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
