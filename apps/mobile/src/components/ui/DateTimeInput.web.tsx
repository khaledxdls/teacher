import { createElement } from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import type { DateTimeInputProps } from './DateTimeInput';

/** Web fallback: the native picker module has no web implementation, so use the browser's input. */
export default function DateTimeInput({ mode, value, onChange, accessibilityLabel, minimumDate }: DateTimeInputProps) {
  const { palette } = useTheme();
  return createElement('input', {
    type: mode,
    value,
    min: minimumDate,
    'aria-label': accessibilityLabel,
    onChange: (event: { target: { value: string } }) => {
      if (event.target.value) onChange(event.target.value);
    },
    style: {
      font: 'inherit',
      fontSize: 16,
      fontWeight: 700,
      padding: '10px 12px',
      borderRadius: 10,
      border: `1px solid ${palette.border}`,
      background: palette.surface,
      color: palette.text,
      colorScheme: palette.scheme,
    },
  });
}
