import { Text, View } from 'react-native';
import DateTimeInput from '../../../components/ui/DateTimeInput';
import { defaultEndTime, timeToMinutes } from '../../../domain/dates';
import { TimeOfDay } from '../../../domain/types';
import { useI18n } from '../../../i18n/I18nProvider';
import { createStyles } from '../../../theme/createStyles';

type TimeRange = { startTime: TimeOfDay; endTime: TimeOfDay };
type Props = TimeRange & { onChange: (range: TimeRange) => void };

/** Start and end time; moving the start past the end pushes the end one hour later. */
export default function TimeRangeField({ startTime, endTime, onChange }: Props) {
  const styles = useStyles();
  const { t } = useI18n();

  const changeStart = (time: TimeOfDay) =>
    onChange({ startTime: time, endTime: timeToMinutes(endTime) <= timeToMinutes(time) ? defaultEndTime(time) : endTime });

  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <Text style={styles.label}>{t('editor.starts')}</Text>
        <DateTimeInput mode="time" value={startTime} onChange={changeStart} accessibilityLabel={t('editor.starts')} />
      </View>
      <Text style={styles.separator}>{t('editor.to')}</Text>
      <View style={styles.field}>
        <Text style={styles.label}>{t('editor.ends')}</Text>
        <DateTimeInput mode="time" value={endTime} onChange={(time) => onChange({ startTime, endTime: time })} accessibilityLabel={t('editor.ends')} />
      </View>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 10 },
  field: { flex: 1, gap: 6, alignItems: 'flex-start' },
  label: { color: c.textSubtle, fontSize: 11, fontWeight: '700' },
  separator: { color: c.textSubtle, paddingBottom: 12 },
}));
