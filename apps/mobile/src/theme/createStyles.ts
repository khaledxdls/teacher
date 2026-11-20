import { ImageStyle, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { Palette } from './palette';
import { useTheme } from './ThemeProvider';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Declares themed styles once at module level and returns a hook:
 *
 *   const useStyles = createStyles((c) => ({ card: { backgroundColor: c.surface } }));
 *   const styles = useStyles();
 *
 * Each palette's StyleSheet is built once and cached, so switching themes is cheap.
 */
export function createStyles<T extends NamedStyles<T>>(factory: (palette: Palette) => T) {
  const cache = new WeakMap<Palette, T>();
  return function useStyles(): T {
    const { palette } = useTheme();
    let styles = cache.get(palette);
    if (!styles) {
      styles = StyleSheet.create(factory(palette));
      cache.set(palette, styles);
    }
    return styles;
  };
}
