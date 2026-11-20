import { Alert, Platform } from 'react-native';
import { SeriesScope } from '../../domain/recurrence';
import type { I18n } from '../../i18n/I18nProvider';

/** Asks whether a change to a repeating lesson applies to this lesson only or to the following ones too. */
export function chooseScope(t: I18n['t'], action: 'edit' | 'delete'): Promise<SeriesScope | null> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve(window.confirm(t('editor.scopeWebPrompt')) ? 'following' : 'single');
      return;
    }
    Alert.alert(
      t('editor.scopeTitle'),
      t(action === 'edit' ? 'editor.scopeEdit' : 'editor.scopeDelete'),
      [
        { text: t('editor.scopeSingle'), onPress: () => resolve('single') },
        { text: t('editor.scopeFollowing'), onPress: () => resolve('following'), style: action === 'delete' ? 'destructive' : 'default' },
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
