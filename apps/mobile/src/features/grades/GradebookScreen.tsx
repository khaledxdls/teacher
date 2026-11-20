import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ListRow from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import { assessmentAverage, gradedCount } from '../../domain/grades';
import { SavedClass } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useAssessments } from '../../state/planner';
import { useSharedStyles } from '../../theme/sharedStyles';
import MissingClass from '../classes/MissingClass';
import { useRouteClass } from '../classes/useRouteClass';
import AssessmentFormModal from './AssessmentFormModal';

export default function GradebookScreen() {
  const { savedClass } = useRouteClass();
  return savedClass ? <Gradebook savedClass={savedClass} /> : <MissingClass />;
}

function Gradebook({ savedClass }: { savedClass: SavedClass }) {
  const shared = useSharedStyles();
  const router = useRouter();
  const { t, formatDate } = useI18n();
  const assessments = useAssessments(savedClass.id);
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
            const average = assessmentAverage(assessment, savedClass.students);
            return (
              <ListRow
                key={assessment.id}
                divider={index > 0}
                title={assessment.title}
                subtitle={[
                  formatDate(assessment.date, 'dayMonthYear'),
                  t('grades.graded', { count: gradedCount(assessment, savedClass.students), total: savedClass.students.length }),
                  average === null ? t('grades.noScores') : t('grades.classAverage', { value: average }),
                ].join(' · ')}
                onPress={() => openAssessment(assessment.id)}
              />
            );
          })}
        </Card>
      ) : (
        <Text style={shared.emptyText}>{t('grades.empty')}</Text>
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
