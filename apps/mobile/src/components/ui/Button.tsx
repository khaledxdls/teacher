import { ActivityIndicator, Pressable, StyleProp, Text, ViewStyle } from 'react-native';
import { createStyles } from '../../theme/createStyles';
import { useTheme } from '../../theme/ThemeProvider';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export default function Button({ label, onPress, variant = 'primary', disabled, loading, style, accessibilityLabel }: Props) {
  const styles = useStyles();
  const { palette } = useTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, inactive && styles.disabled, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? palette.onPrimary : palette.primary} />
        : <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>}
    </Pressable>
  );
}

const useStyles = createStyles((c) => ({
  base: { borderRadius: 11, padding: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  primary: { backgroundColor: c.primary },
  secondary: { backgroundColor: c.primarySoft },
  outline: { borderWidth: 1, borderColor: c.border },
  text: {},
  danger: {},
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  label: { fontWeight: '800', textAlign: 'center' },
  primaryLabel: { color: c.onPrimary },
  secondaryLabel: { color: c.primary },
  outlineLabel: { color: c.primary },
  textLabel: { color: c.textMuted, fontWeight: '700' },
  dangerLabel: { color: c.danger },
}));
