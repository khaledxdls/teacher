import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { createStyles } from '../../theme/createStyles';
import Toast from '../feedback/Toast';

type Props = { children: ReactNode; toastMessage?: string | null; footer?: ReactNode };

/** Scrollable page body for screens that use the navigator's header. */
export default function Screen({ children, toastMessage = null, footer }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
        {children}
      </ScrollView>
      {footer}
      <Toast message={toastMessage} />
    </View>
  );
}

const useStyles = createStyles((c) => ({
  root: { flex: 1, backgroundColor: c.background },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
}));
