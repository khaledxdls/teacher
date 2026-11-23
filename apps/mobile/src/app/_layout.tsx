import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ReminderScheduler } from '../features/reminders/ReminderScheduler';
import { I18nProvider, useI18n } from '../i18n/I18nProvider';
import { installGlobalErrorHandler } from '../services/errorReporting';
import { PlannerProvider } from '../state/PlannerProvider';
import { PreferencesProvider } from '../state/PreferencesProvider';
import { SyncProvider } from '../state/SyncProvider';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

export const unstable_settings = { anchor: '(tabs)' };

/**
 * Provider order matters: preferences drive theme and language; planner data is needed by
 * sync and reminders.
 */
export default function RootLayout() {
  useEffect(installGlobalErrorHandler, []);
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <ThemeProvider>
          <I18nProvider>
            <PlannerProvider>
              <SyncProvider>
                <ReminderScheduler />
                <RootStack />
              </SyncProvider>
            </PlannerProvider>
          </I18nProvider>
        </ThemeProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { palette } = useTheme();
  const { t } = useI18n();
  return (
    <Stack
      screenOptions={{
        headerTintColor: palette.primary,
        headerTitleStyle: { color: palette.text, fontWeight: '800' },
        headerTransparent: false,
        headerStyle: { backgroundColor: palette.surface },
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="lesson/[id]" options={{ title: t('lesson.title') }} />
      <Stack.Screen name="class/[id]/index" options={{ title: t('classDetail.title') }} />
      <Stack.Screen name="class/[id]/insights" options={{ title: t('insights.title') }} />
      <Stack.Screen name="class/[id]/grades" options={{ title: t('grades.title') }} />
      <Stack.Screen name="class/[id]/assessment/[assessmentId]" options={{ title: t('grades.title') }} />
      <Stack.Screen name="class/[id]/report" options={{ title: t('report.title') }} />
      <Stack.Screen name="class/[id]/student/[studentId]" options={{ title: t('student.title') }} />
      <Stack.Screen name="calendar" options={{ title: t('calendar.title') }} />
      <Stack.Screen name="follow-ups" options={{ title: t('followUps.title') }} />
      <Stack.Screen name="account/change-password" options={{ title: t('password.changeTitle'), presentation: 'modal' }} />
      <Stack.Screen name="account/forgot-password" options={{ title: t('password.forgotTitle'), presentation: 'modal' }} />
    </Stack>
  );
}
