import { useCallback } from 'react';
import { Result } from '../domain/errors';
import { useI18n } from '../i18n/I18nProvider';

/**
 * Turns a command result into user feedback: shows the translated error, or the optional
 * success message. Returns whether the action succeeded.
 */
export function useActionFeedback(show: (message: string) => void) {
  const { tError } = useI18n();
  return useCallback(<T,>(result: Result<T>, successMessage?: string): result is { ok: true; value: T } => {
    if (!result.ok) {
      show(tError(result.error));
      return false;
    }
    if (successMessage) show(successMessage);
    return true;
  }, [show, tError]);
}
