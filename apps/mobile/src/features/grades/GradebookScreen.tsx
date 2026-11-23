import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ListRow from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import { assessmentAverage, gradedCount } from '../../domain/grades';
import { SavedClass } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useAssessments, useScoreIndex, useStudents } from '../../state/planner';
import MissingClass from '../classes/MissingClass';
import { useRouteClass } from '../classes/useRouteClass';
import AssessmentFormModal from './AssessmentFormModal';

export default function GradebookScreen() {
  const { savedClass } = useRouteClass();
  return savedClass ? <Gradebook savedClass={savedClass} /> : <MissingClass />;
}

function Gradebook({ savedClass }: { savedClass: SavedClass }) {
  const router = useRouter();
  const { t, formatDate } = useI18n();
  const assessments = useAssessments(savedClass.id);
  const students = useStudents(savedClass.id);
  const scores = useScoreIndex();
  const [creating, setCreating] = useState(false);

  const openAssessment = (assessmentId: string) =>
    router.push({ pathname: '/class/[id]/assessment/[assessmentId]', params: { id: savedClass.id, assessmentId } });

  return (
    <Screen>
      <Stack.Screen options={{ title: `${t('grades.title')} · ${savedClass.name}` }} />
      <Button label={t('grades.newAssessment')} onPress={() => setCreating(true)} />
      {assessments.length > 0 ? (
        <Card flush>
          {assessments.map((assessment, index) => {
            const average = assessmentAverage(assessment, scores, students);
            return (
              <ListRow
                key={assessment.id}
                divider={index > 0}
                title={assessment.title}
                subtitle={[
                  formatDate(assessment.date, 'dayMonthYear'),
                  t('grades.graded', { count: gradedCount(assessment, scores, students), total: students.length }),
                  average === null ? t('grades.noScores') : t('grades.classAverage', { value: average }),
                ].join(' · ')}
                onPress={() => openAssessment(assessment.id)}
              />
            );
          })}
        </Card>
      ) : (
        <EmptyState icon="school-outline" title={t('empty.gradesTitle')} message={t('empty.gradesMessage')} />
      )}
      <AssessmentFormModal
        visible={creating}
        classId={savedClass.id}
        onClose={() => setCreating(false)}
        onSaved={(assessment) => openAssessment(assessment.id)}
      />
    </Screen>
  );
}
