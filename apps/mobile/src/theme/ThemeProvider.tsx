import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { usePreferences } from '../state/PreferencesProvider';
import { darkPalette, lightPalette, Palette } from './palette';

type ThemeContextValue = { palette: Palette };

const ThemeContext = createContext<ThemeContextValue>({ palette: lightPalette });

export const useTheme = () => useContext(ThemeContext);

/** Picks the palette from the user's preference (or the system setting) and themes navigation to match. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const systemScheme = useColorScheme();
  const scheme = preferences.theme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preferences.theme;
  const palette = scheme === 'dark' ? darkPalette : lightPalette;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.background).catch(() => undefined);
  }, [palette]);

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.primary,
        background: palette.background,
        card: palette.surface,
        text: palette.text,
        border: palette.divider,
        notification: palette.danger,
      },
    };
  }, [scheme, palette]);

  const value = useMemo(() => ({ palette }), [palette]);

  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}
