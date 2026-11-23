import { Text, View } from 'react-native';
import { createStyles } from '../../theme/createStyles';

export type Bar = { key: string; label: string; value: number | null };

type Props = {
  bars: Bar[];
  /** Value of a full-height bar (e.g. 100 for percentages). */
  max?: number;
  formatValue?: (value: number) => string;
  /** Bars below this value are drawn in the warning colour. */
  warnBelow?: number;
  accessibilityLabel: string;
};

const CHART_HEIGHT = 110;

/** A small vertical bar chart for percentages and similar values; `null` bars show a dash. */
export default function BarChart({ bars, max = 100, formatValue = (value) => `${value}%`, warnBelow, accessibilityLabel }: Props) {
  const styles = useStyles();
  const summary = bars.map((bar) => `${bar.label}: ${bar.value === null ? '–' : formatValue(bar.value)}`).join(', ');
  return (
    <View style={styles.chart} accessible accessibilityLabel={`${accessibilityLabel}. ${summary}`}>
      {bars.map((bar) => {
        const height = bar.value === null ? 0 : Math.max(4, Math.round((Math.min(bar.value, max) / max) * CHART_HEIGHT));
        const warn = bar.value !== null && warnBelow !== undefined && bar.value < warnBelow;
        return (
          <View key={bar.key} style={styles.column}>
            <Text style={styles.value} numberOfLines={1}>{bar.value === null ? '–' : formatValue(bar.value)}</Text>
            <View style={styles.track}>
              <View style={[styles.bar, warn && styles.warn, { height }]} />
            </View>
            <Text style={styles.label} numberOfLines={1}>{bar.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: 4 },
  column: { flex: 1, alignItems: 'center', gap: 4 },
  value: { color: c.textMuted, fontSize: 10, fontWeight: '700' },
  track: { height: CHART_HEIGHT, width: '100%', justifyContent: 'flex-end', backgroundColor: c.surfaceMuted, borderRadius: 6, overflow: 'hidden' },
  bar: { width: '100%', backgroundColor: c.primary, borderRadius: 6 },
  warn: { backgroundColor: c.warning },
  label: { color: c.textSubtle, fontSize: 10 },
}));
