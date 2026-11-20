import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { createStyles } from '../../theme/createStyles';

type Props = { label: string; children: ReactNode; inline?: boolean };

/** A label with any control beneath it (or beside it when `inline`). */
export default function LabeledField({ label, children, inline }: Props) {
  const styles = useStyles();
  return (
    <View style={[styles.field, inline && styles.inline]}>
      <Text style={[styles.label, inline && styles.inlineLabel]}>{label}</Text>
      {children}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  field: { gap: 7, marginBottom: 10, flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: c.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'auto' },
  inlineLabel: { fontSize: 14, color: c.text, fontWeight: '600' },
}));
