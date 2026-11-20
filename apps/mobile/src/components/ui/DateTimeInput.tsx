import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { dateKey, formatTime, parseDateKey, timeToDate } from '../../domain/dates';
import { useI18n } from '../../i18n/I18nProvider';
import { createStyles } from '../../theme/createStyles';
import { useTheme } from '../../theme/ThemeProvider';

export type DateTimeInputProps = {
  mode: 'date' | 'time';
  /** `YYYY-MM-DD` for dates, `HH:MM` for times. */
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
  minimumDate?: string;
};

const toDate = (mode: DateTimeInputProps['mode'], value: string) => (mode === 'date' ? parseDateKey(value) : timeToDate(value));
const fromDate = (mode: DateTimeInputProps['mode'], date: Date) => (mode === 'date' ? dateKey(date) : formatTime(date));

/**
 * Native date/time input. iOS shows the compact inline picker; Android shows a button that
 * opens the system dialog. (The web build uses DateTimeInput.web.tsx.)
 */
export default function DateTimeInput({ mode, value, onChange, accessibilityLabel, minimumDate }: DateTimeInputProps) {
  const styles = useStyles();
  const { palette } = useTheme();
  const { formatDate, language } = useI18n();
  const [open, setOpen] = useState(false);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && date) onChange(fromDate(mode, date));
  };

  const picker = (display: 'compact' | 'default') => (
    <DateTimePicker
      value={toDate(mode, value)}
      mode={mode}
      display={display}
      onChange={handleChange}
      minimumDate={minimumDate ? parseDateKey(minimumDate) : undefined}
      locale={language}
      themeVariant={palette.scheme}
      accentColor={palette.primary}
      accessibilityLabel={accessibilityLabel}
    />
  );

  if (Platform.OS === 'ios') return picker('compact');

  return (
    <>
      <Pressable style={styles.button} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${accessibilityLabel}: ${value}`}>
        <Text style={styles.value}>{mode === 'date' ? formatDate(value, 'dayMonthYear') : value}</Text>
      </Pressable>
      {open && picker('default')}
    </>
  );
}

const useStyles = createStyles((c) => ({
  button: { borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: c.surface },
  value: { color: c.text, fontSize: 16, fontWeight: '700' },
}));
