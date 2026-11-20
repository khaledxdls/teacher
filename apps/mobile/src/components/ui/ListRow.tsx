import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '../../i18n/I18nProvider';
import { createStyles } from '../../theme/createStyles';

type Props = {
  title: string;
  subtitle?: string;
  /** Content on the trailing side (badge, switch, button). A chevron is shown when pressable and empty. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Draws a divider above the row (for rows inside a flush Card). */
  divider?: boolean;
  accessibilityLabel?: string;
};

/** One line of a list: title, optional subtitle and trailing content. */
export default function ListRow({ title, subtitle, trailing, onPress, divider, accessibilityLabel }: Props) {
  const styles = useStyles();
  const { isRTL } = useI18n();
  const content = (
    <>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Text style={styles.chevron}>{isRTL ? '‹' : '›'}</Text> : null)}
    </>
  );

  if (!onPress) return <View style={[styles.row, divider && styles.divider]}>{content}</View>;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
    >
      {content}
    </Pressable>
  );
}

const useStyles = createStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, minHeight: 52 },
  divider: { borderTopWidth: 1, borderTopColor: c.divider },
  pressed: { backgroundColor: c.surfaceMuted },
  text: { flex: 1 },
  title: { color: c.text, fontSize: 15, fontWeight: '600', textAlign: 'auto' },
  subtitle: { color: c.textSubtle, fontSize: 12, marginTop: 3, textAlign: 'auto' },
  chevron: { color: c.textFaint, fontSize: 26 },
}));
