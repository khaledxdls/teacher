import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ListRow from '../../components/ui/ListRow';
import PromptModal from '../../components/ui/PromptModal';
import Screen from '../../components/ui/Screen';
import TextField from '../../components/ui/TextField';
import { dateKey } from '../../domain/dates';
import { SavedClass, Student } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useClasses, useLessons, usePlannerActions } from '../../state/planner';
import { useSharedStyles } from '../../theme/sharedStyles';

type StudentMatch = { student: Student; savedClass: SavedClass };

const matches = (text: string, query: string) => text.toLocaleLowerCase().includes(query);

export default function ClassesScreen() {
  const shared = useSharedStyles();
  const router = useRouter();
  const { t, tError } = useI18n();
  const classes = useClasses();
  const lessons = useLessons();
  const actions = usePlannerActions();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');

  const upcomingByClass = useMemo(() => {
    const today = dateKey(new Date());
    const counts = new Map<string, number>();
    for (const lesson of lessons) {
      if (lesson.date >= today) counts.set(lesson.classId, (counts.get(lesson.classId) ?? 0) + 1);
    }
    return counts;
  }, [lessons]);

  const search = query.trim().toLocaleLowerCase();
  const visibleClasses = search ? classes.filter((item) => matches(item.name, search)) : classes;
  const studentMatches = useMemo<StudentMatch[]>(() => (search
    ? classes.flatMap((savedClass) => savedClass.students
      .filter((student) => matches(student.name, search))
      .map((student) => ({ student, savedClass })))
    : []), [classes, search]);

  const openClass = (id: string) => router.push({ pathname: '/class/[id]', params: { id } });

  return (
    <Screen>
      <Button label={t('classes.newClass')} onPress={() => setCreating(true)} />
      {classes.length > 0 && (
        <TextField placeholder={t('classes.search')} value={query} onChangeText={setQuery} autoCorrect={false} clearButtonMode="while-editing" />
      )}

      {visibleClasses.length > 0 && (
        <Card flush>
          {visibleClasses.map((item, index) => {
            const upcoming = upcomingByClass.get(item.id) ?? 0;
            return (
              <ListRow
                key={item.id}
                divider={index > 0}
                title={item.name}
                subtitle={`${t('classes.students', { count: item.students.length })} · ${t('classes.upcoming', { count: upcoming })}`}
                onPress={() => openClass(item.id)}
              />
            );
          })}
        </Card>
      )}

      {studentMatches.length > 0 && (
        <Card flush>
          {studentMatches.map(({ student, savedClass }, index) => (
            <ListRow
              key={`${savedClass.id}:${student.id}`}
              divider={index > 0}
              title={student.name}
              subtitle={t('classes.studentIn', { className: savedClass.name })}
              onPress={() => router.push({ pathname: '/class/[id]/student/[studentId]', params: { id: savedClass.id, studentId: student.id } })}
            />
          ))}
        </Card>
      )}

      {classes.length === 0 && <Text style={shared.emptyText}>{t('classes.empty')}</Text>}
      {search !== '' && visibleClasses.length === 0 && studentMatches.length === 0 && (
        <Text style={shared.emptyText}>{t('classes.noResults', { query: query.trim() })}</Text>
      )}

      <PromptModal
        visible={creating}
        title={t('classes.newClassTitle')}
        confirmLabel={t('common.create')}
        fields={[{ name: 'name', placeholder: t('classes.namePlaceholder') }]}
        onSubmit={({ name }) => {
          if (classes.some((item) => item.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())) {
            return tError({ code: 'classNameTaken' });
          }
          const result = actions.addClass({ name });
          return result.ok ? null : tError(result.error);
        }}
        onClose={() => setCreating(false)}
      />
    </Screen>
  );
}
