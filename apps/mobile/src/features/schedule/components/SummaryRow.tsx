import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme/colors';

type Props = { classes: number; teachingDays: number; templates: number };

export default function SummaryRow({ classes, teachingDays, templates }: Props) {
  const items = [
    { label: 'Classes', value: classes },
    { label: 'Teaching days', value: teachingDays },
    { label: 'Templates', value: templates },
  ];
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View key={item.label} style={styles.card}>
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: 13, padding: 12, borderWidth: 1, borderColor: colors.divider },
  value: { color: colors.navy, fontSize: 22, fontWeight: '800' },
  label: { color: colors.textSubtle, fontSize: 11, marginTop: 3 },
});
