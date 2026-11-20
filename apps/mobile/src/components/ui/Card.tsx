import { ReactNode } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { createStyles } from '../../theme/createStyles';

type Props = {
  title?: string;
  /** Rendered on the trailing side of the title row (e.g. an action link). */
  action?: ReactNode;
  children: ReactNode;
  /** Removes inner padding so rows can span the full width. */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A titled surface that groups related content. */
export default function Card({ title, action, children, flush, style }: Props) {
  const styles = useStyles();
  return (
    <View style={[styles.card, flush && styles.flush, style]}>
      {(title || action) && (
        <View style={[styles.header, flush && styles.headerFlush]}>
          {title ? <Text style={styles.title} accessibilityRole="header">{title}</Text> : <View />}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.divider, gap: 8 },
  flush: { padding: 0, overflow: 'hidden', gap: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  headerFlush: { padding: 16, paddingBottom: 10 },
  title: { color: c.text, fontSize: 17, fontWeight: '800', flexShrink: 1, textAlign: 'auto' },
}));
