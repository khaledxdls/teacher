import { Text } from 'react-native';
import { createStyles } from '../../theme/createStyles';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'purple';

/** A small all-caps label, e.g. NOTE or REPEATS. */
export default function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const styles = useStyles();
  return <Text style={[styles.badge, styles[tone]]}>{label}</Text>;
}

const useStyles = createStyles((c) => ({
  badge: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  neutral: { color: c.textMuted, backgroundColor: c.surfaceMuted },
  primary: { color: c.primary, backgroundColor: c.primarySoft },
  success: { color: c.success, backgroundColor: c.successSoft },
  warning: { color: c.warning, backgroundColor: c.warningSoft },
  danger: { color: c.danger, backgroundColor: c.dangerSoft },
  purple: { color: c.purple, backgroundColor: c.primarySoft },
}));
