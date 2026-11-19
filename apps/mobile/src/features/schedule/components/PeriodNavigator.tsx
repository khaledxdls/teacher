import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme/colors';

export type ScheduleView = 'week' | 'month';
const VIEWS: { value: ScheduleView; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

type Props = {
  label: string;
  view: ScheduleView;
  onPrevious: () => void;
  onNext: () => void;
  onChangeView: (view: ScheduleView) => void;
};

export default function PeriodNavigator({ label, view, onPrevious, onNext, onChangeView }: Props) {
  return (
    <>
      <View style={styles.toolbar}>
        <Pressable onPress={onPrevious} accessibilityRole="button" accessibilityLabel={`Previous ${view}`} hitSlop={8}>
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Text style={styles.period}>{label}</Text>
        <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel={`Next ${view}`} hitSlop={8}>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      </View>
      <View style={styles.segmented} accessibilityRole="tablist">
        {VIEWS.map((option) => {
          const active = view === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => onChangeView(option.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  arrow: { fontSize: 36, color: colors.primary, paddingHorizontal: 10 },
  period: { color: colors.navy, fontSize: 16, fontWeight: '700' },
  segmented: { flexDirection: 'row', backgroundColor: colors.segmentTrack, borderRadius: 12, padding: 4, marginBottom: 18 },
  segment: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 9 },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.textMuted, fontWeight: '700' },
  segmentTextActive: { color: colors.navy },
});
