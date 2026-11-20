import { Pressable, Text, View } from 'react-native';
import SegmentedControl from '../../../components/ui/SegmentedControl';
import { useI18n } from '../../../i18n/I18nProvider';
import { createStyles } from '../../../theme/createStyles';

export type ScheduleView = 'week' | 'month';

type Props = {
  label: string;
  /** Extra line under the period, e.g. "Week A". */
  caption?: string | null;
  view: ScheduleView;
  onPrevious: () => void;
  onNext: () => void;
  onChangeView: (view: ScheduleView) => void;
};

export default function PeriodNavigator({ label, caption, view, onPrevious, onNext, onChangeView }: Props) {
  const styles = useStyles();
  const { t, isRTL } = useI18n();
  // Arrows point in reading direction, so they swap in right-to-left layouts.
  const [backArrow, forwardArrow] = isRTL ? ['›', '‹'] : ['‹', '›'];
  return (
    <>
      <View style={styles.toolbar}>
        <Pressable onPress={onPrevious} accessibilityRole="button" hitSlop={8}
          accessibilityLabel={t(view === 'week' ? 'schedule.previousWeek' : 'schedule.previousMonth')}>
          <Text style={styles.arrow}>{backArrow}</Text>
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.period}>{label}</Text>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        </View>
        <Pressable onPress={onNext} accessibilityRole="button" hitSlop={8}
          accessibilityLabel={t(view === 'week' ? 'schedule.nextWeek' : 'schedule.nextMonth')}>
          <Text style={styles.arrow}>{forwardArrow}</Text>
        </Pressable>
      </View>
      <SegmentedControl
        value={view}
        onChange={onChangeView}
        options={[{ value: 'week', label: t('schedule.week') }, { value: 'month', label: t('schedule.month') }]}
      />
    </>
  );
}

const useStyles = createStyles((c) => ({
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  center: { alignItems: 'center', flex: 1 },
  arrow: { fontSize: 36, color: c.primary, paddingHorizontal: 10 },
  period: { color: c.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  caption: { color: c.primary, fontSize: 12, fontWeight: '800', marginTop: 2 },
}));
