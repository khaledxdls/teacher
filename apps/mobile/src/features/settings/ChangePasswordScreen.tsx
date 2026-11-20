import { useRouter } from 'expo-router';
import { useState } from 'react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Screen from '../../components/ui/Screen';
import TextField from '../../components/ui/TextField';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { api } from '../../services/api';
import { useSync } from '../../state/SyncProvider';
import { describeError } from './describeError';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const sync = useSync();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!sync.session) return;
    if (next.length < 8) return toast.show(t('account.passwordTooShort'));
    setBusy(true);
    try {
      // The server signs out other devices and returns a fresh session for this one.
      await sync.adoptSession(await api.changePassword(sync.session.token, current, next));
      toast.show(t('password.changed'));
      setTimeout(() => router.back(), 1200);
    } catch (error) {
      toast.show(describeError(error, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen toastMessage={toast.message}>
      <Card>
        <TextField label={t('password.current')} value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" />
        <TextField label={t('password.new')} value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={() => void submit()} />
        <Button label={t('account.changePassword')} onPress={() => void submit()} loading={busy} disabled={!current || !next} />
      </Card>
    </Screen>
  );
}
