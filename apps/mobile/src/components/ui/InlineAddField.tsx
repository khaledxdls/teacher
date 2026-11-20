import { Pressable, Text, TextInput, View } from 'react-native';
import { useI18n } from '../../i18n/I18nProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { useSharedStyles } from '../../theme/sharedStyles';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
};

/** A text field with an "Add" button, for quickly adding items to a list. */
export default function InlineAddField({ value, onChange, onSubmit, placeholder }: Props) {
  const shared = useSharedStyles();
  const { palette } = useTheme();
  const { t } = useI18n();
  return (
    <View style={shared.inlineAddRow}>
      <TextInput
        style={shared.inlineAddInput}
        placeholder={placeholder}
        placeholderTextColor={palette.textFaint}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        returnKeyType="done"
        accessibilityLabel={placeholder}
      />
      <Pressable style={shared.inlineAddButton} onPress={onSubmit} accessibilityRole="button" accessibilityLabel={`${t('common.add')}: ${placeholder}`}>
        <Text style={shared.inlineAddText}>{t('common.add')}</Text>
      </Pressable>
    </View>
  );
}
