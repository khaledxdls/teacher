import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { ColorValue } from 'react-native';
import { useSync } from '../../state/SyncProvider';
import { colors } from '../../theme/colors';

type IconName = ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName) => function TabIcon({ color, size }: { color: ColorValue | null; size: number }) {
  return <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />;
};

export default function TabsLayout() {
  const sync = useSync();
  // Small dot on the Account tab when signed out or when the last sync failed.
  const accountBadge = sync.ready && (!sync.session || sync.status === 'error') ? '' : undefined;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        headerTitleStyle: { color: colors.navy, fontWeight: '800' },
        headerStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Schedule', headerShown: false, tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="classes" options={{ title: 'Classes', tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="templates" options={{ title: 'Templates', tabBarIcon: icon('copy-outline') }} />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: icon('person-circle-outline'),
          tabBarBadge: accountBadge,
          tabBarBadgeStyle: { minWidth: 10, maxHeight: 10, borderRadius: 5, backgroundColor: colors.danger },
        }}
      />
    </Tabs>
  );
}
