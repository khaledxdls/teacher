import { ar } from '../locales/ar';
import { en } from '../locales/en';
import { fr } from '../locales/fr';
import { selectPlural } from '../plural';
import { resolveLanguage, translate } from '../translate';

type Tree = { [key: string]: string | Tree };

/** Every leaf as [path, text]; plural forms count as separate leaves. */
const leaves = (tree: Tree, prefix = ''): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value] as [string, string]] : leaves(value, `${prefix}${key}.`));

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('dictionaries', () => {
  const english = new Map(leaves(en as unknown as Tree));

  it.each([['fr', fr], ['ar', ar]])('%s has no empty messages and only uses placeholders that English uses', (_, dictionary) => {
    for (const [path, text] of leaves(dictionary as unknown as Tree)) {
      expect(text.trim()).not.toBe('');
      // A plural form may use any placeholder from any English form of the same message.
      const pluralBase = path.match(/^(.*)\.(zero|one|two|few|many|other)$/)?.[1];
      const sources = pluralBase && english.has(`${pluralBase}.other`)
        ? [...english].filter(([key]) => key.startsWith(`${pluralBase}.`)).map(([, value]) => value)
        : [english.get(path)];
      expect(sources.every(Boolean)).toBe(true);
      const allowed = new Set(['count', ...sources.flatMap((source) => placeholders(source!))]);
      for (const name of placeholders(text)) expect(allowed.has(name)).toBe(true);
    }
  });
});

describe('translate', () => {
  it('interpolates params and falls back to the key', () => {
    expect(translate('en', 'common.room', { room: '12' })).toBe('Room 12');
    expect(translate('fr', 'common.room', { room: '12' })).toBe('Salle 12');
    expect(translate('en', 'nope.missing' as never)).toBe('nope.missing');
  });

  it('selects plural forms per language', () => {
    expect(translate('en', 'classes.students', { count: 0 })).toBe('No students');
    expect(translate('en', 'classes.students', { count: 1 })).toBe('1 student');
    expect(translate('en', 'classes.students', { count: 5 })).toBe('5 students');
    expect(translate('fr', 'editor.created', { count: 1 })).toBe('Cours ajouté.');
    expect(translate('ar', 'classes.students', { count: 2 })).toBe('تلميذان');
    expect(translate('ar', 'classes.students', { count: 5 })).toBe('5 تلاميذ');
    expect(translate('ar', 'classes.students', { count: 11 })).toBe('11 تلميذًا');
    expect(translate('ar', 'classes.students', { count: 100 })).toBe('100 تلميذ');
  });

  it('uses Arabic plural categories', () => {
    const forms = { zero: 'z', one: 'o', two: 't', few: 'f', many: 'm', other: 'x' };
    expect([0, 1, 2, 3, 10, 11, 99, 100, 102, 103].map((count) => selectPlural(forms, 'ar', count)))
      .toEqual(['z', 'o', 't', 'f', 'f', 'm', 'm', 'x', 'x', 'f']);
    expect(selectPlural({ one: 'o', other: 'x' }, 'fr', 0)).toBe('o');
  });

  it('resolves the system language', () => {
    expect(resolveLanguage('system', 'fr')).toBe('fr');
    expect(resolveLanguage('system', 'de')).toBe('en');
    expect(resolveLanguage('system', null)).toBe('en');
    expect(resolveLanguage('ar', 'fr')).toBe('ar');
  });
});
