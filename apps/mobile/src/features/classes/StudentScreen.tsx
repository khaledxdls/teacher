import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Screen from '../../components/ui/Screen';
import TextField from '../../components/ui/TextField';
import { attendanceRate, studentAttendanceStats } from '../../domain/attendance';
import { sortBehaviorNotes } from '../../domain/behavior';
import { percentage, scoreOf, studentAverage } from '../../domain/grades';
import { hasHomework, homeworkRate, studentHomeworkStats } from '../../domain/homework';
import { findLive } from '../../domain/records';
import { SavedClass, Student } from '../../domain/types';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { useAssessments, useBehaviorNotes, useLessons, usePlannerActions, usePlannerSelector, useScoreIndex } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';
import { useSharedStyles } from '../../theme/sharedStyles';
import MissingClass from './MissingClass';
import { useRouteClass } from './useRouteClass';

const RECENT_NOTES = 10;

export default function StudentScreen() {
  const { t } = useI18n();
  const { savedClass } = useRouteClass();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const student = usePlannerSelector((state) => findLive(state.students, studentId ?? ''));
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
  const attendance = usePlannerSelector((state) => state.attendance);
  const homework = usePlannerSelector((state) => state.homework);
  const assessments = useAssessments(savedClass.id);
  const scores = useScoreIndex();
  const allNotes = useBehaviorNotes();
  const confirm = useConfirm();
  const toast = useToast();
  const feedback = useActionFeedback(toast.show);
  const [form, setForm] = useState({ name: student.name, notes: student.notes ?? '', contact: student.contact ?? '' });

  const classLessons = useMemo(() => lessons.filter((lesson) => lesson.classId === savedClass.id), [lessons, savedClass.id]);
  const attendanceStats = useMemo(
    () => studentAttendanceStats(attendance, new Set(classLessons.map((lesson) => lesson.id))).get(student.id),
    [attendance, classLessons, student.id],
  );
  const homeworkStats = useMemo(
    () => studentHomeworkStats(homework, new Set(classLessons.filter(hasHomework).map((lesson) => lesson.id))).get(student.id),
    [homework, classLessons, student.id],
  );
  const notes = useMemo(() => sortBehaviorNotes(allNotes.filter((note) => note.studentId === student.id)), [allNotes, student.id]);
  const rate = attendanceStats ? attendanceRate(attendanceStats) : null;
  const handedIn = homeworkStats ? homeworkRate(homeworkStats) : null;
  const average = studentAverage(assessments, scores, student.id);
  const graded = assessments.filter((assessment) => scoreOf(scores, assessment.id, student.id) !== undefined);
  const positives = notes.filter((note) => note.kind === 'positive').length;

  const save = () => feedback(actions.updateStudent({ studentId: student.id, patch: form }), t('student.saved'));

  function remove() {
    confirm(t('classDetail.removeStudentTitle'), t('classDetail.removeStudentMessage', { name: student.name, className: savedClass.name }), t('common.remove'), () => {
      if (feedback(actions.removeStudent({ studentId: student.id }))) router.back();
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
        {attendanceStats && <Text style={shared.subtitle}>{t('attendance.totals', attendanceStats)}</Text>}
      </Card>

      {homeworkStats && (
        <Card title={t('lesson.homework')}>
          <Text style={shared.title}>{t('homework.rate', { rate: handedIn ?? 0 })}</Text>
          <Text style={shared.subtitle}>{t('homework.totals', homeworkStats)}</Text>
        </Card>
      )}

      <Card title={t('grades.title')}>
        {average !== null && <Text style={shared.title}>{t('grades.studentAverage', { value: average })}</Text>}
        {graded.map((assessment) => {
          const value = scoreOf(scores, assessment.id, student.id)!;
          return (
            <Text key={assessment.id} style={shared.subtitle}>
              {assessment.title} · {formatDate(assessment.date, 'dayMonth')} · {value} {t('grades.outOf', { max: assessment.maxScore })} ({percentage(value, assessment.maxScore)}%)
            </Text>
          );
        })}
        {graded.length === 0 && <Text style={shared.hint}>{t('grades.noScores')}</Text>}
      </Card>

      <Card title={t('lesson.behavior')}>
        {notes.length > 0 && <Text style={shared.title}>{t('behavior.counts', { positive: positives, negative: notes.length - positives })}</Text>}
        {notes.slice(0, RECENT_NOTES).map((note) => (
          <View key={note.id} style={styles.noteRow}>
            <Text style={[styles.noteKind, note.kind === 'positive' ? styles.positive : styles.negative]}>{note.kind === 'positive' ? '＋' : '−'}</Text>
            <Text style={styles.noteText}>{formatDate(note.date, 'dayMonth')}{note.note ? ` · ${note.note}` : ''}</Text>
            <Pressable onPress={() => feedback(actions.deleteBehaviorNote({ id: note.id }))} accessibilityRole="button" accessibilityLabel={t('behavior.deleteNote')} hitSlop={8}>
              <Text style={styles.delete}>×</Text>
            </Pressable>
          </View>
        ))}
        {notes.length === 0 && <Text style={shared.hint}>{t('behavior.none')}</Text>}
      </Card>

      <Button label={t('student.remove')} variant="danger" onPress={remove} />
    </Screen>
  );
}

const useStyles = createStyles((c) => ({
  multiline: { minHeight: 76 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  noteKind: { width: 24, textAlign: 'center', fontWeight: '800', fontSize: 16 },
  positive: { color: c.success },
  negative: { color: c.danger },
  noteText: { flex: 1, color: c.text, textAlign: 'auto' },
  delete: { color: c.textFaint, fontSize: 20 },
}));
