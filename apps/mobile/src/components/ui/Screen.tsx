import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Toast from '../feedback/Toast';
import { colors } from '../../theme/colors';

type Props = { children: ReactNode; toastMessage?: string | null; footer?: ReactNode };

/** Scrollable page body for screens that use the navigator's header. */
export default function Screen({ children, toastMessage = null, footer }: Props) {
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        {children}
      </ScrollView>
      {footer}
      <Toast message={toastMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
});
