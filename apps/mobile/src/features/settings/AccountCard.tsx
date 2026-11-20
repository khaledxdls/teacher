import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import PromptModal from '../../components/ui/PromptModal';
import { useConfirm } from '../../hooks/useConfirm';
import { useI18n } from '../../i18n/I18nProvider';
import { api } from '../../services/api';
import { useSync } from '../../state/SyncProvider';
import { createStyles } from '../../theme/createStyles';
import { useSharedStyles } from '../../theme/sharedStyles';
import { describeError } from './describeError';

/** The signed-in account: sync status and account actions. */
export default function AccountCard() {
  const styles = useStyles();
  const shared = useSharedStyles();
  const router = useRouter();
  const { t, formatRelative } = useI18n();
  const sync = useSync();
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState(false);
  const session = sync.session!;

  const statusText = sync.status === 'syncing'
    ? t('account.syncing')
    : sync.status === 'error'
      ? t('account.syncFailed', { error: describeError(sync.error, t) })
      : sync.lastSyncedAt ? t('account.synced', { time: formatRelative(sync.lastSyncedAt) }) : t('account.notSynced');

  const signOut = () => confirm(t('account.signOutTitle'), t('account.signOutMessage'), t('account.signOut'), () => void sync.signOut());

  async function deleteAccount(password: string) {
    try {
      await api.deleteAccount(session.token, password);
      await sync.signOut('accountDeleted');
      return null;
    } catch (error) {
      return describeError(error, t);
    }
  }

  return (
    <Card title={t('settings.account')}>
      {session.user.name ? <Text style={shared.title}>{session.user.name}</Text> : null}
      <Text style={styles.email}>{session.user.email}</Text>
      <View style={styles.statusRow}>
        <View style={[styles.dot, styles[sync.status === 'error' ? 'dotError' : sync.status === 'syncing' ? 'dotBusy' : 'dotOk']]} />
        <Text style={[styles.status, sync.status === 'error' && styles.statusError]}>{statusText}</Text>
      </View>
      {sync.pendingChanges > 0 && sync.status !== 'syncing' && (
        <Text style={shared.hint}>{t('account.pending', { count: sync.pendingChanges })}</Text>
      )}
      <View style={styles.buttons}>
        <Button label={t('account.syncNow')} variant="secondary" onPress={() => void sync.syncNow()} loading={sync.status === 'syncing'} />
        <Button label={t('account.changePassword')} variant="outline" onPress={() => router.push('/account/change-password')} />
        <Button label={t('account.signOut')} variant="text" onPress={signOut} />
        <Button label={t('account.deleteAccount')} variant="danger" onPress={() => setDeleting(true)} />
      </View>
      <PromptModal
        visible={deleting}
        title={t('account.deleteTitle')}
        message={t('account.deleteMessage')}
        confirmLabel={t('account.deleteConfirm')}
        confirmVariant="danger"
        fields={[{
          name: 'password',
          placeholder: t('account.passwordToConfirm'),
          inputProps: { secureTextEntry: true, autoComplete: 'current-password', textContentType: 'password' },
        }]}
        onSubmit={({ password }) => deleteAccount(password)}
        onClose={() => setDeleting(false)}
      />
    </Card>
  );
}

const useStyles = createStyles((c) => ({
  email: { color: c.textMuted, textAlign: 'auto' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOk: { backgroundColor: c.success },
  dotBusy: { backgroundColor: c.warning },
  dotError: { backgroundColor: c.danger },
  status: { color: c.text, fontSize: 13, flex: 1, textAlign: 'auto' },
  statusError: { color: c.danger },
  buttons: { gap: 6, marginTop: 8 },
}));
