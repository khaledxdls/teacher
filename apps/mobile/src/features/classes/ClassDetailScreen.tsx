import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import InlineAddField from '../../components/ui/InlineAddField';
import ListRow from '../../components/ui/ListRow';
import PromptModal from '../../components/ui/PromptModal';
import Screen from '../../components/ui/Screen';
import { attendanceRate, studentAttendanceStats } from '../../domain/attendance';
import { studentAverage } from '../../domain/grades';
import { SavedClass } from '../../domain/types';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { useAssessments, useLessons, usePlannerActions } from '../../state/planner';
import { useSharedStyles } from '../../theme/sharedStyles';
import MissingClass from './MissingClass';
import { useRouteClass } from './useRouteClass';

export default function ClassDetailScreen() {
  const { savedClass } = useRouteClass();
  return savedClass ? <ClassDetail savedClass={savedClass} /> : <MissingClass />;
}

function ClassDetail({ savedClass }: { savedClass: SavedClass }) {
  const shared = useSharedStyles();
  const router = useRouter();
  const { t, tError } = useI18n();
  const lessons = useLessons();
  const assessments = useAssessments(savedClass.id);
  const actions = usePlannerActions();
  const confirm = useConfirm();
  const toast = useToast();
  const feedback = useActionFeedback(toast.show);
  const [studentName, setStudentName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const stats = useMemo(() => studentAttendanceStats(lessons, savedClass.id), [lessons, savedClass.id]);
  const params = { id: savedClass.id };

  function addStudent() {
    if (feedback(actions.addStudent({ classId: savedClass.id, name: studentName }))) setStudentName('');
  }

  function deleteClass() {
    confirm(t('classDetail.deleteTitle'), t('classDetail.deleteMessage', { name: savedClass.name }), t('common.delete'), () => {
      if (feedback(actions.deleteClass({ id: savedClass.id }))) router.back();
    });
  }

  function studentSummary(studentId: string) {
    const record = stats.get(studentId);
    const rate = record ? attendanceRate(record) : null;
    const average = studentAverage(assessments, studentId);
    return [
      rate === null ? t('attendance.noneYet') : t('attendance.rate', { rate }),
      average === null ? null : t('grades.studentAverage', { value: average }),
    ].filter(Boolean).join(' · ');
  }

  return (
    <Screen toastMessage={toast.message}>
      <Stack.Screen options={{ title: savedClass.name }} />

      <Card flush title={t('classDetail.students', { count: savedClass.students.length })}>
        <InlineAddField value={studentName} onChange={setStudentName} onSubmit={addStudent} placeholder={t('classDetail.studentName')} />
        {savedClass.students.map((student) => (
          <ListRow
            key={student.id}
            divider
            title={student.name}
            subtitle={studentSummary(student.id)}
            onPress={() => router.push({ pathname: '/class/[id]/student/[studentId]', params: { ...params, studentId: student.id } })}
          />
        ))}
        {savedClass.students.length === 0 && <Text style={shared.emptyText}>{t('classDetail.noStudents')}</Text>}
      </Card>

      <Button label={t('classDetail.gradebook')} variant="secondary" onPress={() => router.push({ pathname: '/class/[id]/grades', params })} />
      <Button label={t('classDetail.report')} variant="secondary" onPress={() => router.push({ pathname: '/class/[id]/report', params })} />
      <Button label={t('classDetail.rename')} variant="outline" onPress={() => setRenaming(true)} />
      <Button label={t('classDetail.delete')} variant="danger" onPress={deleteClass} />

      <PromptModal
        visible={renaming}
        title={t('classDetail.renameTitle')}
        fields={[{ name: 'name', placeholder: t('classes.namePlaceholder'), initialValue: savedClass.name }]}
        onSubmit={({ name }) => {
          const result = actions.renameClass({ id: savedClass.id, name });
          return result.ok ? null : tError(result.error);
        }}
        onClose={() => setRenaming(false)}
      />
    </Screen>
  );
}
