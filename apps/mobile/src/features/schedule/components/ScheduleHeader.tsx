import { Pressable, Text, View } from 'react-native';
import { useI18n } from '../../../i18n/I18nProvider';
import { createStyles } from '../../../theme/createStyles';

type Props = { onAddLesson: () => void };

export default function ScheduleHeader({ onAddLesson }: Props) {
  const styles = useStyles();
  const { t } = useI18n();
  return (
    <View style={styles.header}>
      <View style={styles.text}>
        <Text style={styles.eyebrow}>{t('schedule.eyebrow')}</Text>
        <Text style={styles.title} accessibilityRole="header">{t('schedule.title')}</Text>
        <Text style={styles.subtitle}>{t('schedule.subtitle')}</Text>
      </View>
      <Pressable style={styles.addButton} onPress={onAddLesson} accessibilityRole="button" accessibilityLabel={t('schedule.addLesson')}>
        <Text style={styles.addIcon}>＋</Text>
        <Text style={styles.addLabel}>{t('schedule.addLesson')}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  header: { backgroundColor: c.header, margin: -20, marginBottom: 20, padding: 24, paddingTop: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  text: { flex: 1 },
  eyebrow: { color: c.onHeaderMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textAlign: 'auto' },
  title: { color: c.onHeader, fontSize: 28, fontWeight: '800', marginTop: 5, textAlign: 'auto' },
  subtitle: { color: c.onHeaderMuted, marginTop: 5, textAlign: 'auto' },
  addButton: { backgroundColor: c.primary, minWidth: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  addIcon: { color: c.onPrimary, fontSize: 25, lineHeight: 25 },
  addLabel: { color: c.onPrimary, fontSize: 9, fontWeight: '800', marginTop: 2 },
}));
