import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Screen from '../../components/ui/Screen';
import TextField from '../../components/ui/TextField';
import { attendanceRate, studentAttendanceStats } from '../../domain/attendance';
import { percentage, studentAverage } from '../../domain/grades';
import { SavedClass, Student } from '../../domain/types';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { useAssessments, useLessons, usePlannerActions } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';
import { useSharedStyles } from '../../theme/sharedStyles';
import MissingClass from './MissingClass';
import { useRouteClass } from './useRouteClass';

export default function StudentScreen() {
  const { t } = useI18n();
  const { savedClass } = useRouteClass();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const student = savedClass?.students.find((item) => item.id === studentId);
  if (!savedClass) return <MissingClass />;
  if (!student) return <MissingClass message={t('student.missing')} />;
  return <StudentDetail key={student.id} savedClass={savedClass} student={student} />;
}

function StudentDetail({ savedClass, student }: { savedClass: SavedClass; student: Student }) {
  const styles = useStyles();
  const shared = useSharedStyles();
  const router = useRouter();
  const { t, formatDate } = useI18n();
  const actions = usePlannerActions();
  const lessons = useLessons();
  const assessments = useAssessments(savedClass.id);
  const confirm = useConfirm();
  const toast = useToast();
  const feedback = useActionFeedback(toast.show);
  const [form, setForm] = useState({ name: student.name, notes: student.notes ?? '', contact: student.contact ?? '' });

  const stats = useMemo(() => studentAttendanceStats(lessons, savedClass.id).get(student.id), [lessons, savedClass.id, student.id]);
  const rate = stats ? attendanceRate(stats) : null;
  const average = studentAverage(assessments, student.id);
  const graded = assessments.filter((assessment) => assessment.scores[student.id] !== undefined);

  const save = () => feedback(actions.updateStudent({ classId: savedClass.id, studentId: student.id, patch: form }), t('student.saved'));

  function remove() {
    confirm(t('classDetail.removeStudentTitle'), t('classDetail.removeStudentMessage', { name: student.name, className: savedClass.name }), t('common.remove'), () => {
      if (feedback(actions.removeStudent({ classId: savedClass.id, studentId: student.id }))) router.back();
    });
  }

  return (
    <Screen toastMessage={toast.message}>
      <Stack.Screen options={{ title: student.name }} />
      <Card>
        <TextField label={t('student.name')} value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} />
        <TextField
          label={t('student.notes')}
          placeholder={t('student.notesPlaceholder')}
          value={form.notes}
          onChangeText={(notes) => setForm((current) => ({ ...current, notes }))}
          multiline
          style={styles.multiline}
          textAlignVertical="top"
        />
        <TextField
          label={t('student.contact')}
          placeholder={t('student.contactPlaceholder')}
          value={form.contact}
          onChangeText={(contact) => setForm((current) => ({ ...current, contact }))}
        />
        <Button label={t('common.save')} onPress={save} />
      </Card>

      <Card title={t('attendance.title')}>
        <Text style={shared.title}>{rate === null ? t('attendance.noneYet') : t('attendance.rate', { rate })}</Text>
        {stats && <Text style={shared.subtitle}>{t('attendance.totals', stats)}</Text>}
      </Card>

      <Card title={t('grades.title')}>
        {average !== null && <Text style={shared.title}>{t('grades.studentAverage', { value: average })}</Text>}
        {graded.map((assessment) => (
          <Text key={assessment.id} style={shared.subtitle}>
            {assessment.title} · {formatDate(assessment.date, 'dayMonth')} · {assessment.scores[student.id]} {t('grades.outOf', { max: assessment.maxScore })} ({percentage(assessment.scores[student.id], assessment.maxScore)}%)
          </Text>
        ))}
        {graded.length === 0 && <Text style={shared.hint}>{t('grades.noScores')}</Text>}
      </Card>

      <Button label={t('student.remove')} variant="danger" onPress={remove} />
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  multiline: { minHeight: 76 },
}));
