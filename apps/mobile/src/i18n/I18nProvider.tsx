import { reloadAppAsync } from 'expo';
import { useLocales } from 'expo-localization';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo } from 'react';
import { I18nManager, Platform } from 'react-native';
import { isDateKey, parseDateKey } from '../domain/dates';
import { ActionError } from '../domain/errors';
import { usePreferences } from '../state/PreferencesProvider';
import { resolveLanguage, translate, TranslationKey } from './translate';
import { Language, MessageParams, RTL_LANGUAGES } from './types';

export type DateStyle = 'weekday' | 'weekdayDay' | 'dayMonth' | 'dayMonthYear' | 'full' | 'monthYear';

const DATE_FORMATS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  weekday: { weekday: 'short' },
  weekdayDay: { weekday: 'short', day: 'numeric' },
  dayMonth: { weekday: 'short', day: 'numeric', month: 'short' },
  dayMonthYear: { day: 'numeric', month: 'short', year: 'numeric' },
  full: { weekday: 'long', day: 'numeric', month: 'long' },
  monthYear: { month: 'long', year: 'numeric' },
};

export type I18n = {
  language: Language;
  isRTL: boolean;
  t: (key: TranslationKey, params?: MessageParams) => string;
  /** Translates a domain validation error, formatting date params for display. */
  tError: (error: ActionError) => string;
  formatDate: (date: Date | string, style: DateStyle) => string;
  formatRelative: (timestamp: number) => string;
  formatDuration: (minutes: number) => string;
  /** True when the layout direction changed and the app must restart to apply it. */
  needsRestart: boolean;
  restart: () => void;
};

const I18nContext = createContext<I18n | null>(null);

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}

/**
 * Native apps switch layout direction only after a reload: `I18nManager.isRTL` keeps the
 * direction the app started with, so a mismatch means a restart is needed. The web switches immediately.
 */
function useLayoutDirection(isRTL: boolean) {
  const needsRestart = Platform.OS !== 'web' && I18nManager.isRTL !== isRTL;
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      return;
    }
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
  }, [isRTL]);
  return needsRestart;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const [deviceLocale] = useLocales();
  const language = resolveLanguage(preferences.language, deviceLocale?.languageCode);
  const isRTL = RTL_LANGUAGES.has(language);
  const needsRestart = useLayoutDirection(isRTL);

  const restart = useCallback(() => {
    reloadAppAsync('Layout direction changed').catch(() => undefined);
  }, []);

  const value = useMemo<I18n>(() => {
    const t = (key: TranslationKey, params?: MessageParams) => translate(language, key, params);
    const formatDate = (date: Date | string, style: DateStyle) =>
      (typeof date === 'string' ? parseDateKey(date) : date).toLocaleDateString(language, DATE_FORMATS[style]);

    return {
      language,
      isRTL,
      t,
      formatDate,
      tError: ({ code, params }) => {
        const formatted = params && Object.fromEntries(Object.entries(params).map(([name, value]) =>
          [name, typeof value === 'string' && isDateKey(value) ? formatDate(value, 'dayMonth') : value]));
        return t(`errors.${code}`, formatted);
      },
      formatRelative: (timestamp) => {
        const minutes = Math.round((Date.now() - timestamp) / 60_000);
        if (minutes < 1) return t('relative.justNow');
        if (minutes < 60) return t('relative.minutesAgo', { count: minutes });
        const hours = Math.round(minutes / 60);
        if (hours < 24) return t('relative.hoursAgo', { count: hours });
        return formatDate(new Date(timestamp), 'dayMonthYear');
      },
      formatDuration: (total) => {
        const minutes = Math.max(0, Math.round(total));
        if (minutes < 60) return t('duration.minutes', { count: minutes });
        if (minutes < 24 * 60) return t('duration.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
        return t('duration.days', { count: Math.round(minutes / (24 * 60)) });
      },
      needsRestart,
      restart,
    };
  }, [language, isRTL, needsRestart, restart]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
