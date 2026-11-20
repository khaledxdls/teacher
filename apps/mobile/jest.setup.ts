// Global test doubles for native modules that have no JS implementation under Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('expo-system-ui', () => ({ setBackgroundColorAsync: jest.fn(async () => undefined) }));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US', textDirection: 'ltr' }],
  useLocales: () => [{ languageCode: 'en', languageTag: 'en-US', textDirection: 'ltr' }],
}));
