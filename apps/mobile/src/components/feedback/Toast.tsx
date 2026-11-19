import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

type ToastProps = {
  message: string | null;
};

export default function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <View style={styles.toast} pointerEvents="none" accessibilityLiveRegion="polite" accessibilityRole="alert">
      <View style={styles.icon}><Text style={styles.iconText}>!</Text></View>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navy,
    borderRadius: 14,
    padding: 14,
    shadowColor: colors.navy,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    marginRight: 10,
  },
  iconText: { color: colors.surface, fontWeight: '800' },
  message: { flex: 1, color: colors.surface, fontSize: 13, lineHeight: 18 },
});
