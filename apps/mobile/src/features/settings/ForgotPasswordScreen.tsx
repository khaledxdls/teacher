import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Screen from '../../components/ui/Screen';
import TextField from '../../components/ui/TextField';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { api } from '../../services/api';
import { useSync } from '../../state/SyncProvider';
import { useSharedStyles } from '../../theme/sharedStyles';
import { describeError } from './describeError';

/** Two steps: request a 6-digit code by email, then enter it with a new password. */
export default function ForgotPasswordScreen() {
  const shared = useSharedStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { t } = useI18n();
  const sync = useSync();
  const toast = useToast();
  const [email, setEmail] = useState(params.email ?? '');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      toast.show(describeError(error, t));
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () => run(async () => {
    if (!email.trim()) return toast.show(t('account.enterEmailPassword'));
    await api.requestPasswordReset(email.trim());
    setCodeSent(true);
  });

  const reset = () => run(async () => {
    if (password.length < 8) return toast.show(t('account.passwordTooShort'));
    await sync.adoptSession(await api.resetPassword(email.trim(), code.trim(), password));
    toast.show(t('password.resetDone'));
    setTimeout(() => router.back(), 1200);
  });

  return (
    <Screen toastMessage={toast.message}>
      <Card>
        <Text style={shared.hint}>{t('password.forgotIntro')}</Text>
        <TextField
          placeholder={t('account.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          editable={!codeSent}
        />
        {!codeSent ? (
          <Button label={t('password.sendCode')} onPress={() => void sendCode()} loading={busy} />
        ) : (
          <>
            <Text style={shared.hint}>{t('password.codeSent', { email: email.trim() })}</Text>
            <TextField placeholder={t('password.code')} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" />
            <TextField placeholder={t('password.new')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
            <Button label={t('password.reset')} onPress={() => void reset()} loading={busy} disabled={code.trim().length !== 6 || !password} />
            <Button label={t('password.resend')} variant="text" onPress={() => void sendCode()} disabled={busy} />
          </>
        )}
      </Card>
    </Screen>
  );
}
