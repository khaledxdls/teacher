/** Plural variants, chosen with the language's plural rules (see plural.ts). */
export type PluralForms = { zero?: string; one: string; two?: string; few?: string; many?: string; other: string };

/** The structure every dictionary must follow: same keys as English, strings or plural forms as leaves. */
export type DictionaryShape<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends { other: string } ? PluralForms : DictionaryShape<T[K]>;
};

/** Dotted paths to every message, e.g. `"schedule.addLesson"`. */
export type MessageKey<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends { other: string }
      ? `${Prefix}${K}`
      : MessageKey<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageParams = Record<string, string | number>;

export type Language = 'en' | 'fr' | 'ar';
export const LANGUAGES: Language[] = ['en', 'fr', 'ar'];
export const RTL_LANGUAGES: ReadonlySet<Language> = new Set(['ar']);
