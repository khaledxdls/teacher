import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlannerProvider } from '../state/PlannerProvider';
import { SyncProvider } from '../state/SyncProvider';
import { colors } from '../theme/colors';

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PlannerProvider>
        <SyncProvider>
          <Stack
            screenOptions={{
              headerTintColor: colors.primary,
              headerTitleStyle: { color: colors.navy, fontWeight: '800' },
              headerTransparent: false,
              headerStyle: { backgroundColor: colors.surface },
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="class/[id]" options={{ title: 'Class', headerBackTitle: 'Back' }} />
          </Stack>
        </SyncProvider>
      </PlannerProvider>
    </SafeAreaProvider>
  );
}
