import { ar } from './locales/ar';
import { en, Messages } from './locales/en';
import { fr } from './locales/fr';
import { selectPlural } from './plural';
import { DictionaryShape, Language, LANGUAGES, MessageKey, MessageParams, PluralForms } from './types';

export type TranslationKey = MessageKey<Messages>;

const dictionaries: Record<Language, DictionaryShape<Messages>> = { en, fr, ar };

type Node = string | PluralForms | { [key: string]: Node };

function lookup(language: Language, key: string): Node | undefined {
  let node: Node | undefined = dictionaries[language] as Node;
  for (const part of key.split('.')) {
    node = typeof node === 'object' && node !== null && !('other' in node && typeof node.other === 'string')
      ? (node as Record<string, Node>)[part]
      : undefined;
  }
  return node;
}

const interpolate = (template: string, params?: MessageParams) =>
  params ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : template;

/** Translates `key`, falling back to English and finally to the key itself. Plurals use `params.count`. */
export function translate(language: Language, key: TranslationKey, params?: MessageParams): string {
  const node = lookup(language, key) ?? lookup('en', key);
  if (typeof node === 'string') return interpolate(node, params);
  if (node && typeof node === 'object' && 'other' in node && typeof node.other === 'string') {
    return interpolate(selectPlural(node as PluralForms, language, Number(params?.count ?? 0)), params);
  }
  return key;
}

/** Resolves the "system" preference against the device's language, defaulting to English. */
export function resolveLanguage(preference: Language | 'system', deviceLanguage: string | null | undefined): Language {
  if (preference !== 'system') return preference;
  return LANGUAGES.find((language) => language === deviceLanguage) ?? 'en';
}

/** Native language names, shown in the language picker regardless of the current language. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', fr: 'Français', ar: 'العربية' };
