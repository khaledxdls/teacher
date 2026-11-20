import { Language, PluralForms } from './types';

type Category = keyof PluralForms;

/**
 * CLDR plural rules for the supported languages. Implemented directly because
 * Intl.PluralRules is not available on every Hermes build.
 */
const rules: Record<Language, (count: number) => Category> = {
  en: (n) => (n === 1 ? 'one' : 'other'),
  fr: (n) => (n === 0 || n === 1 ? 'one' : 'other'),
  ar: (n) => {
    if (n === 0) return 'zero';
    if (n === 1) return 'one';
    if (n === 2) return 'two';
    const lastTwo = n % 100;
    if (lastTwo >= 3 && lastTwo <= 10) return 'few';
    if (lastTwo >= 11 && lastTwo <= 99) return 'many';
    return 'other';
  },
};

/** An explicit `zero` form (e.g. "No students") wins for 0 in every language. */
export function selectPlural(forms: PluralForms, language: Language, count: number): string {
  if (count === 0 && forms.zero) return forms.zero;
  const category = rules[language](Math.abs(Math.trunc(count)));
  return forms[category] ?? forms.other;
}
