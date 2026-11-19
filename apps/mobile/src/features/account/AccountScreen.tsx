import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Button from '../../components/ui/Button';
import { confirmDestructive } from '../../components/ui/confirm';
import Screen from '../../components/ui/Screen';
import { useToast } from '../../hooks/useToast';
import { API_URL } from '../../services/api';
import { usePlanner } from '../../state/PlannerProvider';
import { useSync } from '../../state/SyncProvider';
import { colors } from '../../theme/colors';
import { sharedStyles } from '../../theme/sharedStyles';

function timeAgo(timestamp: number) {
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function AccountScreen() {
  const planner = usePlanner();
  const sync = useSync();
  const toast = useToast();

  return (
    <Screen toastMessage={toast.message}>
      {sync.session ? <SignedIn /> : <SignInForm onError={toast.show} />}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reminders</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Friday planning reminder</Text>
            <Text style={styles.settingHint}>Every Friday at 8:00 AM</Text>
          </View>
          <Switch
            value={planner.weeklyReminder}
            onValueChange={planner.setWeeklyReminder}
            trackColor={{ true: colors.primary }}
            accessibilityLabel="Friday planning reminder"
          />
        </View>
        <Text style={styles.settingHint}>Class reminders are sent 15 minutes before each class.</Text>
      </View>
    </Screen>
  );
}

function SignedIn() {
  const sync = useSync();
  const { user } = sync.session!;
  const statusText = sync.status === 'syncing'
    ? 'Syncing…'
    : sync.status === 'error'
      ? `Sync failed: ${sync.error}`
      : sync.lastSyncedAt ? `Synced ${timeAgo(sync.lastSyncedAt)}` : 'Not synced yet';

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Account</Text>
      {user.name ? <Text style={styles.name}>{user.name}</Text> : null}
      <Text style={styles.email}>{user.email}</Text>
      <View style={styles.statusRow}>
        <View style={[styles.dot, sync.status === 'error' ? styles.dotError : sync.status === 'syncing' ? styles.dotBusy : styles.dotOk]} />
        <Text style={[styles.status, sync.status === 'error' && styles.statusError]}>{statusText}</Text>
      </View>
      {sync.pendingChanges > 0 && sync.status !== 'syncing' && (
        <Text style={styles.settingHint}>{sync.pendingChanges} change{sync.pendingChanges === 1 ? '' : 's'} waiting to upload</Text>
      )}
      <View style={styles.buttons}>
        <Button label="Sync now" variant="secondary" onPress={() => void sync.syncNow()} loading={sync.status === 'syncing'} />
        <Button
          label="Sign out"
          variant="danger"
          onPress={() => confirmDestructive(
            'Sign out?',
            'Your schedule stays on this phone, but it will stop syncing until you sign in again.',
            'Sign out',
            () => void sync.signOut(),
          )}
        />
      </View>
    </View>
  );
}

function SignInForm({ onError }: { onError: (message: string) => void }) {
  const sync = useSync();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      onError('Enter your email and password.');
      return;
    }
    if (mode === 'signUp' && password.length < 8) {
      onError('Use a password with at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signIn') await sync.signIn(email, password);
      else await sync.signUp(email, password, name);
      setPassword('');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{mode === 'signIn' ? 'Sign in to back up your planner' : 'Create your account'}</Text>
      <Text style={styles.settingHint}>
        Your schedule, classes, students and attendance are saved to your account and synced across your devices.
      </Text>
      {sync.error ? <Text style={styles.statusError}>{sync.error}</Text> : null}
      {mode === 'signUp' && (
        <TextInput style={sharedStyles.input} placeholder="Name (optional)" value={name} onChangeText={setName} autoComplete="name" />
      )}
      <TextInput
        style={sharedStyles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextInput
        style={sharedStyles.input}
        placeholder={mode === 'signUp' ? 'Password (8+ characters)' : 'Password'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
        textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
        onSubmitEditing={() => void submit()}
      />
      <Button label={mode === 'signIn' ? 'Sign in' : 'Create account'} onPress={() => void submit()} loading={busy} />
      <Button
        variant="text"
        label={mode === 'signIn' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
      />
      {__DEV__ && <Text style={styles.devHint}>Server: {API_URL}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.divider, gap: 8 },
  cardTitle: { color: colors.navy, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  name: { color: colors.navy, fontSize: 15, fontWeight: '700' },
  email: { color: colors.textMuted },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOk: { backgroundColor: '#20bf6b' },
  dotBusy: { backgroundColor: '#f7b731' },
  dotError: { backgroundColor: colors.danger },
  status: { color: colors.navy, fontSize: 13, flex: 1 },
  statusError: { color: colors.danger, fontSize: 13 },
  buttons: { gap: 4, marginTop: 8 },
  settingRow: { flexDirection: 'row', alignItems: 'center' },
  settingText: { flex: 1 },
  settingTitle: { color: colors.navy, fontWeight: '700' },
  settingHint: { color: colors.textMuted, fontSize: 12 },
  devHint: { color: colors.textFaint, fontSize: 11, textAlign: 'center' },
});
