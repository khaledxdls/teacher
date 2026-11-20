import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
};

/** Asks before a destructive action. React Native Web's Alert has no buttons, so web uses window.confirm. */
export function confirmDestructive({ title, message, confirmLabel, cancelLabel, onConfirm }: ConfirmOptions) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
