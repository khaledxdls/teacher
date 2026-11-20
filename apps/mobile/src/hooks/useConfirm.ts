import { useCallback } from 'react';
import { confirmDestructive } from '../components/ui/confirm';
import { useI18n } from '../i18n/I18nProvider';

/** `confirm(title, message, confirmLabel, onConfirm)` with a translated Cancel button. */
export function useConfirm() {
  const { t } = useI18n();
  return useCallback((title: string, message: string, confirmLabel: string, onConfirm: () => void) =>
    confirmDestructive({ title, message, confirmLabel, cancelLabel: t('common.cancel'), onConfirm }), [t]);
}
