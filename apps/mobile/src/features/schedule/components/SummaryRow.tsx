import { Text, View } from 'react-native';
import { useI18n } from '../../../i18n/I18nProvider';
import { createStyles } from '../../../theme/createStyles';

type Props = { lessons: number; teachingDays: number; templates: number };

export default function SummaryRow({ lessons, teachingDays, templates }: Props) {
  const styles = useStyles();
  const { t } = useI18n();
  const items = [
    { label: t('schedule.lessons'), value: lessons },
    { label: t('schedule.teachingDays'), value: teachingDays },
    { label: t('schedule.templates'), value: templates },
  ];
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View key={item.label} style={styles.card} accessible accessibilityLabel={`${item.value} ${item.label}`}>
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  row: { flexDirection: 'row', gap: 8, marginVertical: 18 },
  card: { flex: 1, backgroundColor: c.surface, borderRadius: 13, padding: 12, borderWidth: 1, borderColor: c.divider },
  value: { color: c.text, fontSize: 22, fontWeight: '800', textAlign: 'auto' },
  label: { color: c.textSubtle, fontSize: 11, marginTop: 3, textAlign: 'auto' },
}));
