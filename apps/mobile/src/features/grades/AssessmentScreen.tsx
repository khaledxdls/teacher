import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Screen from '../../components/ui/Screen';
import { assessmentAverage, gradedCount, parseScore, ScoreIndex, scoreOf } from '../../domain/grades';
import { Assessment, SavedClass, Student } from '../../domain/types';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { useAssessments, usePlannerActions, useScoreIndex, useStudents } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';
import { useTheme } from '../../theme/ThemeProvider';
import { useSharedStyles } from '../../theme/sharedStyles';
import MissingClass from '../classes/MissingClass';
import { useRouteClass } from '../classes/useRouteClass';
import AssessmentFormModal from './AssessmentFormModal';

export default function AssessmentScreen() {
  const { t } = useI18n();
  const { savedClass } = useRouteClass();
  const { assessmentId } = useLocalSearchParams<{ assessmentId: string }>();
  const assessment = useAssessments(savedClass?.id).find((item) => item.id === assessmentId);
  if (!savedClass) return <MissingClass />;
  if (!assessment) return <MissingClass message={t('errors.assessmentMissing')} />;
  return <AssessmentDetail savedClass={savedClass} assessment={assessment} />;
}

function AssessmentDetail({ savedClass, assessment }: { savedClass: SavedClass; assessment: Assessment }) {
  const shared = useSharedStyles();
  const router = useRouter();
  const { t, formatDate } = useI18n();
  const actions = usePlannerActions();
  const confirm = useConfirm();
  const toast = useToast();
  const feedback = useActionFeedback(toast.show);
  const [editing, setEditing] = useState(false);
  const students = useStudents(savedClass.id);
  const scores = useScoreIndex();
  const average = assessmentAverage(assessment, scores, students);

  function remove() {
    confirm(t('grades.deleteTitle'), t('grades.deleteMessage', { title: assessment.title }), t('common.delete'), () => {
      if (feedback(actions.deleteAssessment({ id: assessment.id }))) router.back();
    });
  }

  return (
    <Screen toastMessage={toast.message}>
      <Stack.Screen options={{ title: assessment.title }} />
      <Card>
        <Text style={shared.title}>{formatDate(assessment.date, 'full')}</Text>
        <Text style={shared.subtitle}>
          {t('grades.graded', { count: gradedCount(assessment, scores, students), total: students.length })}
          {' · '}
          {average === null ? t('grades.noScores') : t('grades.classAverage', { value: average })}
        </Text>
      </Card>

      <Card flush>
        {students.map((student, index) => (
          <ScoreRow key={student.id} student={student} assessment={assessment} scores={scores} divider={index > 0} onError={toast.show} />
        ))}
        {students.length === 0 && <Text style={shared.emptyText}>{t('classDetail.noStudents')}</Text>}
      </Card>

      <Button label={t('grades.editDetails')} variant="outline" onPress={() => setEditing(true)} />
      <Button label={t('common.delete')} variant="danger" onPress={remove} />
      <AssessmentFormModal visible={editing} classId={savedClass.id} assessment={assessment} onClose={() => setEditing(false)} />
    </Screen>
  );
}

type ScoreRowProps = { student: Student; assessment: Assessment; scores: ScoreIndex; divider: boolean; onError: (message: string) => void };

/** One student's score; saved when the field loses focus or the user presses return. */
function ScoreRow({ student, assessment, scores, divider, onError }: ScoreRowProps) {
  const styles = useStyles();
  const { palette } = useTheme();
  const { t, tError } = useI18n();
  const actions = usePlannerActions();
  const stored = scoreOf(scores, assessment.id, student.id);
  const [text, setText] = useState(stored === undefined ? '' : String(stored));

  function commit() {
    const score = parseScore(text);
    if (score === 'invalid') {
      onError(t('grades.invalidScore'));
      return;
    }
    if (score === (stored ?? null)) return;
    const result = actions.setScore({ assessmentId: assessment.id, studentId: student.id, score });
    if (!result.ok) {
      onError(tError(result.error));
      setText(stored === undefined ? '' : String(stored));
    }
  }

  return (
    <View style={[styles.row, divider && styles.divider]}>
      <Text style={styles.name}>{student.name}</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        returnKeyType="done"
        placeholder="–"
        placeholderTextColor={palette.textFaint}
        accessibilityLabel={t('grades.scoreA11y', { name: student.name, max: assessment.maxScore })}
      />
      <Text style={styles.max}>{t('grades.outOf', { max: assessment.maxScore })}</Text>
    </View>
  );
}

const useStyles = createStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  divider: { borderTopWidth: 1, borderTopColor: c.divider },
  name: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600', textAlign: 'auto' },
  input: { width: 72, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, color: c.text, backgroundColor: c.surface, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  max: { color: c.textSubtle, width: 44 },
}));
