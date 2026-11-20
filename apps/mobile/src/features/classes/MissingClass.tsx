import { Stack } from 'expo-router';
import { Text } from 'react-native';
import Screen from '../../components/ui/Screen';
import { useI18n } from '../../i18n/I18nProvider';
import { usePlannerHydrated } from '../../state/planner';
import { useSharedStyles } from '../../theme/sharedStyles';

/** Shown by class sub-screens when the class does not exist (or data is still loading). */
export default function MissingClass({ message }: { message?: string }) {
  const shared = useSharedStyles();
  const { t } = useI18n();
  const hydrated = usePlannerHydrated();
  return (
    <Screen>
      <Stack.Screen options={{ title: t('classDetail.title') }} />
      <Text style={shared.emptyText}>{hydrated ? message ?? t('classDetail.missing') : t('common.loading')}</Text>
    </Screen>
  );
}
