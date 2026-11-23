import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { createStyles } from '../../theme/createStyles';
import { useTheme } from '../../theme/ThemeProvider';
import Button from './Button';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Explains an empty screen and offers the next step. */
export default function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  const styles = useStyles();
  const { palette } = useTheme();
  return (
    <View style={styles.container} accessibilityRole="summary">
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={28} color={palette.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && <Button label={actionLabel} onPress={onAction} style={styles.action} />}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  container: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, gap: 8 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { color: c.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  message: { color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  action: { marginTop: 8, alignSelf: 'stretch' },
}));
