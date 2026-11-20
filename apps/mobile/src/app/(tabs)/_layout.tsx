import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { ColorValue } from 'react-native';
import { useI18n } from '../../i18n/I18nProvider';
import { useSync } from '../../state/SyncProvider';
import { useTheme } from '../../theme/ThemeProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName) => function TabIcon({ color, size }: { color: ColorValue | null; size: number }) {
  return <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />;
};

export default function TabsLayout() {
  const { palette } = useTheme();
  const { t } = useI18n();
  const sync = useSync();
  // Small dot on Settings when signed out or when the last sync failed.
  const settingsBadge = sync.ready && (!sync.session || sync.status === 'error') ? '' : undefined;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textSubtle,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.divider },
        headerTitleStyle: { color: palette.text, fontWeight: '800' },
        headerStyle: { backgroundColor: palette.surface },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.today'), headerShown: false, tabBarIcon: icon('today-outline') }} />
      <Tabs.Screen name="schedule" options={{ title: t('tabs.schedule'), headerShown: false, tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="classes" options={{ title: t('tabs.classes'), tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="templates" options={{ title: t('tabs.templates'), tabBarIcon: icon('copy-outline') }} />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: icon('settings-outline'),
          tabBarBadge: settingsBadge,
          tabBarBadgeStyle: { minWidth: 10, maxHeight: 10, borderRadius: 5, backgroundColor: palette.danger },
        }}
      />
    </Tabs>
  );
}
