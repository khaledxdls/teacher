import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

type Variant = 'primary' | 'secondary' | 'outline' | 'text' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export default function Button({ label, onPress, variant = 'primary', disabled, loading, style, accessibilityLabel }: Props) {
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
        ? <ActivityIndicator color={variant === 'primary' ? colors.surface : colors.primary} />
        : <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 11, padding: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primarySoft },
  outline: { borderWidth: 1, borderColor: colors.border },
  text: {},
  danger: {},
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  label: { fontWeight: '800' },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.surface },
  secondary: { color: colors.primary },
  outline: { color: colors.primary },
  text: { color: colors.textMuted, fontWeight: '700' },
  danger: { color: colors.danger },
});
