import type { I18n } from '../../i18n/I18nProvider';
import { API_URL, ApiError } from '../../services/api';

/** A user-facing message for a failed API call. Server messages are shown as sent. */
export function describeError(error: unknown, t: I18n['t']) {
  if (error instanceof ApiError && error.isNetworkError) return t('account.unreachable', { url: API_URL });
  return error instanceof Error ? error.message : String(error);
}
