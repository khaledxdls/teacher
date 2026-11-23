import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ListRow from '../../components/ui/ListRow';
import PromptModal from '../../components/ui/PromptModal';
import Screen from '../../components/ui/Screen';
import TextField from '../../components/ui/TextField';
import { dateKey } from '../../domain/dates';
import { sameName } from '../../domain/records';
import { useI18n } from '../../i18n/I18nProvider';
import { useClassById, useClasses, useLessons, usePlannerActions, useStudentsByClass } from '../../state/planner';
import { useSharedStyles } from '../../theme/sharedStyles';

const matches = (text: string, query: string) => text.toLocaleLowerCase().includes(query);

export default function ClassesScreen() {
  const shared = useSharedStyles();
  const router = useRouter();
  const { t } = useI18n();
  const classes = useClasses();
  const classById = useClassById();
  const studentsByClass = useStudentsByClass();
  const lessons = useLessons();
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
  const studentMatches = useMemo(() => (search
    ? [...studentsByClass.values()].flat().filter((student) => matches(student.name, search))
    : []), [studentsByClass, search]);

  const openClass = (id: string) => router.push({ pathname: '/class/[id]', params: { id } });

  if (classes.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="people-outline"
          title={t('empty.classesTitle')}
          message={t('empty.classesMessage')}
          actionLabel={t('empty.classesAction')}
          onAction={() => setCreating(true)}
        />
        <NewClassPrompt visible={creating} onClose={() => setCreating(false)} onCreated={openClass} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Button label={t('classes.newClass')} onPress={() => setCreating(true)} />
      <TextField placeholder={t('classes.search')} value={query} onChangeText={setQuery} autoCorrect={false} clearButtonMode="while-editing" />

      {visibleClasses.length > 0 && (
        <Card flush>
          {visibleClasses.map((item, index) => (
            <ListRow
              key={item.id}
              divider={index > 0}
              title={item.name}
              subtitle={`${t('classes.students', { count: studentsByClass.get(item.id)?.length ?? 0 })} · ${t('classes.upcoming', { count: upcomingByClass.get(item.id) ?? 0 })}`}
              onPress={() => openClass(item.id)}
            />
          ))}
        </Card>
      )}

      {studentMatches.length > 0 && (
        <Card flush>
          {studentMatches.map((student, index) => (
            <ListRow
              key={student.id}
              divider={index > 0}
              title={student.name}
              subtitle={t('classes.studentIn', { className: classById.get(student.classId)?.name ?? '' })}
              onPress={() => router.push({ pathname: '/class/[id]/student/[studentId]', params: { id: student.classId, studentId: student.id } })}
            />
          ))}
        </Card>
      )}

      {search !== '' && visibleClasses.length === 0 && studentMatches.length === 0 && (
        <Text style={shared.emptyText}>{t('classes.noResults', { query: query.trim() })}</Text>
      )}

      <NewClassPrompt visible={creating} onClose={() => setCreating(false)} />
    </Screen>
  );

}

type NewClassPromptProps = { visible: boolean; onClose: () => void; onCreated?: (id: string) => void };

/** Asks for a class name and creates the class. */
function NewClassPrompt({ visible, onClose, onCreated }: NewClassPromptProps) {
  const { t, tError } = useI18n();
  const classes = useClasses();
  const actions = usePlannerActions();
  return (
    <PromptModal
      visible={visible}
      title={t('classes.newClassTitle')}
      confirmLabel={t('common.create')}
      fields={[{ name: 'name', placeholder: t('classes.namePlaceholder') }]}
      onSubmit={({ name }) => {
        if (classes.some((item) => sameName(item.name, name))) return tError({ code: 'classNameTaken' });
        const result = actions.addClass({ name });
        if (!result.ok) return tError(result.error);
        onCreated?.(result.value.id);
        return null;
      }}
      onClose={onClose}
    />
  );
}
