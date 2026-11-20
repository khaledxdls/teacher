import { Pressable, Text, View } from 'react-native';
import { createStyles } from '../../theme/createStyles';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

/** A row of mutually exclusive options. */
export default function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const styles = useStyles();
  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.segment, active && styles.active]}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  track: { flexDirection: 'row', backgroundColor: c.segmentTrack, borderRadius: 12, padding: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 9 },
  active: { backgroundColor: c.surface },
  label: { color: c.textMuted, fontWeight: '700', fontSize: 13 },
  activeLabel: { color: c.text },
}));
