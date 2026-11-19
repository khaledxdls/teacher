import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme/colors';

type Props = { onAddClass: () => void };

export default function ScheduleHeader({ onAddClass }: Props) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.eyebrow}>CLASS PILOT</Text>
        <Text style={styles.title}>Your teaching week</Text>
        <Text style={styles.subtitle}>Friday-to-Thursday planning, made simple</Text>
      </View>
      <Pressable style={styles.addButton} onPress={onAddClass} accessibilityRole="button" accessibilityLabel="Add class">
        <Text style={styles.addButtonText}>＋</Text>
        <Text style={styles.addButtonLabel}>Add class</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.navy, margin: -20, marginBottom: 20, padding: 24, paddingTop: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: colors.headerEyebrow, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: colors.surface, fontSize: 30, fontWeight: '800', marginTop: 5 },
  subtitle: { color: colors.headerSubtitle, marginTop: 5 },
  addButton: { backgroundColor: colors.primary, minWidth: 52, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  addButtonText: { color: colors.surface, fontSize: 25, lineHeight: 25 },
  addButtonLabel: { color: colors.surface, fontSize: 9, fontWeight: '800', marginTop: 2 },
});
