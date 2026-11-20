import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { defaultPreferences, loadPreferences, Preferences, savePreferences } from '../services/storage';
import { reportError } from '../services/errorReporting';

type PreferencesContextValue = {
  preferences: Preferences;
  loaded: boolean;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return value;
}

/** Device-local settings (theme, language, reminders). Not synced between devices. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadPreferences()
      .then((stored) => { if (active) setPreferences(stored); })
      .catch((error) => reportError(error, { where: 'loadPreferences' }))
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  // Persist after loading finished, so defaults never overwrite stored preferences.
  useEffect(() => {
    if (loaded) savePreferences(preferences).catch((error) => reportError(error, { where: 'savePreferences' }));
  }, [loaded, preferences]);

  const setPreference = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  }, []);

  const value = useMemo(() => ({ preferences, loaded, setPreference }), [preferences, loaded, setPreference]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
