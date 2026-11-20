import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import TextField from '../../components/ui/TextField';
import { useI18n } from '../../i18n/I18nProvider';
import { API_URL } from '../../services/api';
import { useSync } from '../../state/SyncProvider';
import { createStyles } from '../../theme/createStyles';
import { useSharedStyles } from '../../theme/sharedStyles';
import { describeError } from './describeError';

const MIN_PASSWORD_LENGTH = 8;

export default function SignInCard({ onError }: { onError: (message: string) => void }) {
  const styles = useStyles();
  const shared = useSharedStyles();
  const router = useRouter();
  const { t } = useI18n();
  const sync = useSync();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const signingUp = mode === 'signUp';

  async function submit() {
    if (!email.trim() || !password) return onError(t('account.enterEmailPassword'));
    if (signingUp && password.length < MIN_PASSWORD_LENGTH) return onError(t('account.passwordTooShort'));
    setBusy(true);
    try {
      if (signingUp) await sync.signUp(email, password, name);
      else await sync.signIn(email, password);
      setPassword('');
    } catch (error) {
      onError(describeError(error, t));
    } finally {
      setBusy(false);
    }
  }

  const endedMessage = sync.endReason === 'expired' ? t('account.sessionExpired') : sync.endReason === 'accountDeleted' ? t('account.accountDeleted') : null;

  return (
    <Card title={t(signingUp ? 'account.signUpTitle' : 'account.signInTitle')}>
      <Text style={shared.hint}>{t('account.pitch')}</Text>
      {endedMessage && <Text style={styles.notice}>{endedMessage}</Text>}
      {signingUp && <TextField placeholder={t('account.name')} value={name} onChangeText={setName} autoComplete="name" />}
      <TextField
        placeholder={t('account.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        placeholder={t(signingUp ? 'account.newPassword' : 'account.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={signingUp ? 'new-password' : 'current-password'}
        textContentType={signingUp ? 'newPassword' : 'password'}
        onSubmitEditing={() => void submit()}
      />
      <Button label={t(signingUp ? 'account.signUp' : 'account.signIn')} onPress={() => void submit()} loading={busy} />
      <Button variant="text" label={t(signingUp ? 'account.toSignIn' : 'account.toSignUp')} onPress={() => setMode(signingUp ? 'signIn' : 'signUp')} />
      {!signingUp && (
        <Button variant="text" label={t('account.forgotPassword')} onPress={() => router.push({ pathname: '/account/forgot-password', params: { email } })} />
      )}
      {__DEV__ && <Text style={styles.devHint}>{t('account.server', { url: API_URL })}</Text>}
    </Card>
  );
}

const useStyles = createStyles((c) => ({
  notice: { color: c.warning, backgroundColor: c.warningSoft, padding: 10, borderRadius: 8, overflow: 'hidden', fontSize: 13 },
  devHint: { color: c.textFaint, fontSize: 11, textAlign: 'center' },
}));
