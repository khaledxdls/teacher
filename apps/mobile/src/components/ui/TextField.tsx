import { Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useSharedStyles } from '../../theme/sharedStyles';

type Props = TextInputProps & { label?: string };

/** A themed text input with an optional label above it. */
export default function TextField({ label, style, ...inputProps }: Props) {
  const shared = useSharedStyles();
  const { palette } = useTheme();
  return (
    <View>
      {label ? <Text style={shared.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={[shared.input, style]}
        placeholderTextColor={palette.textFaint}
        accessibilityLabel={inputProps.accessibilityLabel ?? label ?? inputProps.placeholder}
        {...inputProps}
      />
    </View>
  );
}
