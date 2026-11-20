import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Switch, Text, View } from 'react-native';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ListRow from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import SegmentedControl from '../../components/ui/SegmentedControl';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { LANGUAGE_NAMES } from '../../i18n/translate';
import { LANGUAGES } from '../../i18n/types';
import { LanguagePreference, ThemePreference } from '../../services/storage';
import { usePreferences } from '../../state/PreferencesProvider';
import { useSync } from '../../state/SyncProvider';
import { createStyles } from '../../theme/createStyles';
import { useTheme } from '../../theme/ThemeProvider';
import { useSharedStyles } from '../../theme/sharedStyles';
import AccountCard from './AccountCard';
import SignInCard from './SignInCard';

export default function SettingsScreen() {
  const styles = useStyles();
  const shared = useSharedStyles();
  const router = useRouter();
  const { palette } = useTheme();
  const { t, needsRestart, restart } = useI18n();
  const { preferences, setPreference } = usePreferences();
  const sync = useSync();
  const toast = useToast();

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('settings.themeSystem') },
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
  ];
  const languageOptions: { value: LanguagePreference; label: string }[] = [
    { value: 'system', label: t('settings.languageSystem') },
    ...LANGUAGES.map((language) => ({ value: language, label: LANGUAGE_NAMES[language] })),
  ];

  return (
    <Screen toastMessage={toast.message}>
      {sync.session ? <AccountCard /> : <SignInCard onError={toast.show} />}

      <Card title={t('settings.appearance')}>
        <SegmentedControl options={themeOptions} value={preferences.theme} onChange={(theme) => setPreference('theme', theme)} accessibilityLabel={t('settings.appearance')} />
      </Card>

      <Card title={t('settings.language')}>
        <SegmentedControl options={languageOptions} value={preferences.language} onChange={(language) => setPreference('language', language)} accessibilityLabel={t('settings.language')} />
        {needsRestart && (
          <View style={styles.restart}>
            <Text style={shared.title}>{t('settings.restartTitle')}</Text>
            <Text style={shared.hint}>{t('settings.restartMessage')}</Text>
            <Button label={t('settings.restartNow')} onPress={restart} />
          </View>
        )}
      </Card>

      <Card title={t('settings.reminders')}>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>{t('settings.weeklyReminder')}</Text>
            <Text style={shared.hint}>{t('settings.weeklyReminderHint')}</Text>
          </View>
          <Switch
            value={preferences.weeklyReminder}
            onValueChange={(enabled) => setPreference('weeklyReminder', enabled)}
            trackColor={{ true: palette.primary }}
            accessibilityLabel={t('settings.weeklyReminder')}
          />
        </View>
        <Text style={shared.hint}>{t('settings.lessonReminderHint')}</Text>
      </Card>

      <Card flush>
        <ListRow title={t('settings.calendar')} subtitle={t('settings.calendarHint')} onPress={() => router.push('/calendar')} />
        <ListRow divider title={t('settings.followUps')} subtitle={t('settings.followUpsHint')} onPress={() => router.push('/follow-ups')} />
      </Card>

      <Text style={styles.version}>{t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}</Text>
    </Screen>
  );
}

const useStyles = createStyles((c) => ({
  restart: { gap: 8, marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: c.warningSoft },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingText: { flex: 1 },
  settingTitle: { color: c.text, fontWeight: '700', textAlign: 'auto' },
  version: { color: c.textFaint, fontSize: 12, textAlign: 'center', marginTop: 8 },
}));
