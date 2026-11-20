import { Text, View } from 'react-native';
import { createStyles } from '../../theme/createStyles';

type ToastProps = { message: string | null };

export default function Toast({ message }: ToastProps) {
  const styles = useStyles();
  if (!message) return null;

  return (
    <View style={styles.toast} pointerEvents="none" accessibilityLiveRegion="polite" accessibilityRole="alert">
      <View style={styles.icon}><Text style={styles.iconText}>!</Text></View>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  toast: {
    position: 'absolute', start: 20, end: 20, bottom: 24, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.scheme === 'dark' ? c.surfaceHighlight : c.header,
    borderRadius: 14, padding: 14,
    shadowColor: c.shadow, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  icon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.danger },
  iconText: { color: '#fff', fontWeight: '800' },
  message: { flex: 1, color: '#fff', fontSize: 13, lineHeight: 18, textAlign: 'auto' },
}));
