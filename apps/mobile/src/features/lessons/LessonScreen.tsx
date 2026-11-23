import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/ui/Screen';
import { attendanceSummary, nextAttendanceStatus } from '../../domain/attendance';
import { hasHomework, homeworkSummary, nextHomeworkStatus } from '../../domain/homework';
import { isRepeating } from '../../domain/recurrence';
import { findLive } from '../../domain/records';
import { parseDateKey } from '../../domain/dates';
import { AttendanceStatus, HomeworkStatus, ScheduleEntry } from '../../domain/types';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import {
  useAttendanceIndex,
  useBehaviorNotes,
  useClassById,
  useHomeworkIndex,
  usePlannerActions,
  usePlannerHydrated,
  usePlannerSelector,
  useStudents,
} from '../../state/planner';
import { createStyles } from '../../theme/createStyles';
import { useSharedStyles } from '../../theme/sharedStyles';
import LessonEditorModal, { EditorSession } from '../schedule/components/LessonEditorModal';
import BehaviorPanel from './BehaviorPanel';
import LessonNotesEditor from './LessonNotesEditor';
import LessonPlanEditor from './LessonPlanEditor';
import StatusList from './StatusList';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson = usePlannerSelector((state) => findLive(state.entries, id ?? ''));
  const hydrated = usePlannerHydrated();
  const shared = useSharedStyles();
  const { t } = useI18n();
  if (!lesson) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('lesson.title') }} />
        <Text style={shared.emptyText}>{hydrated ? t('lesson.missing') : t('common.loading')}</Text>
      </Screen>
    );
  }
  return <LessonDetail lesson={lesson} />;
}

const ATTENDANCE_TONE = { present: 'success', late: 'warning', absent: 'danger' } as const;
const HOMEWORK_TONE = { done: 'success', late: 'warning', missing: 'danger' } as const;

function LessonDetail({ lesson }: { lesson: ScheduleEntry }) {
  const styles = useStyles();
  const router = useRouter();
  const { t, formatDate } = useI18n();
  const actions = usePlannerActions();
  const savedClass = useClassById().get(lesson.classId);
  const students = useStudents(lesson.classId);
  const attendance = useAttendanceIndex().get(lesson.id);
  const homework = useHomeworkIndex().get(lesson.id);
  const allNotes = useBehaviorNotes();
  const lessonNotes = useMemo(() => allNotes.filter((note) => note.lessonId === lesson.id), [allNotes, lesson.id]);
  const toast = useToast();
  const feedback = useActionFeedback(toast.show);
  const [editor, setEditor] = useState<EditorSession>({ key: 0, visible: false, date: parseDateKey(lesson.date), lesson });

  const summary = attendanceSummary(attendance, students);
  const homeworkCounts = homeworkSummary(homework, students);
  const className = savedClass?.name ?? t('common.unknownClass');
  const openStudents = () => router.push({ pathname: '/class/[id]', params: { id: lesson.classId } });

  return (
    <Screen toastMessage={editor.visible ? null : toast.message}>
      <Stack.Screen options={{ title: lesson.subject }} />

      <Card>
        <Text style={styles.subject} accessibilityRole="header">{lesson.subject}</Text>
        <Text style={styles.meta}>{formatDate(lesson.date, 'full')} · {lesson.startTime}–{lesson.endTime}</Text>
        <Pressable onPress={openStudents} accessibilityRole="link">
          <Text style={styles.classLink}>{className}{lesson.room ? ` · ${t('common.room', { room: lesson.room })}` : ''}</Text>
        </Pressable>
        <View style={styles.badges}>
          {isRepeating(lesson) && <Badge tone="primary" label={t('schedule.badgeRepeats')} />}
        </View>
        <Button
          label={t('lesson.edit')}
          variant="outline"
          onPress={() => setEditor((current) => ({ key: current.key + 1, visible: true, date: parseDateKey(lesson.date), lesson }))}
        />
      </Card>

      {students.length === 0 ? (
        <Card>
          <EmptyState icon="people-outline" title={t('empty.studentsTitle')} message={t('lesson.noStudents')} actionLabel={t('lesson.manageStudents')} onAction={openStudents} />
        </Card>
      ) : (
        <StatusList<AttendanceStatus>
          title={`${t('attendance.title')} · ${summary.present + summary.late}/${students.length}`}
          students={students}
          statusOf={(studentId) => attendance?.get(studentId)}
          next={nextAttendanceStatus}
          onChange={(studentId, status) => feedback(actions.setAttendance({ lessonId: lesson.id, studentId, status: status ?? null }))}
          label={(status) => (status ? t(`attendance.${status}`) : t('attendance.notMarked'))}
          tone={ATTENDANCE_TONE}
          accessibilityLabel={(name, status) => t('attendance.a11y', { name, status })}
          headerAction={(
            <Pressable onPress={() => feedback(actions.markAllPresent({ lessonId: lesson.id }))} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.headerAction}>{t('attendance.markAllPresent')}</Text>
            </Pressable>
          )}
        />
      )}

      <Card title={t('lesson.plan')}>
        {/* Remount only when the saved plan changes, so other edits on this page never reset unsaved text. */}
        <LessonPlanEditor key={JSON.stringify(lesson.plan ?? null)} lesson={lesson} onResult={toast.show} />
      </Card>

      {hasHomework(lesson) && students.length > 0 && (
        <StatusList<HomeworkStatus>
          title={t('lesson.homeworkTracking')}
          students={students}
          statusOf={(studentId) => homework?.get(studentId)}
          next={nextHomeworkStatus}
          onChange={(studentId, status) => feedback(actions.setHomework({ lessonId: lesson.id, studentId, status: status ?? null }))}
          label={(status) => (status ? t(`homework.${status}`) : t('homework.notMarked'))}
          tone={HOMEWORK_TONE}
          accessibilityLabel={(name, status) => t('homework.a11y', { name, status })}
          headerAction={<Text style={styles.headerHint}>{t('homework.totals', homeworkCounts)}</Text>}
        />
      )}

      {students.length > 0 && (
        <Card title={t('lesson.behavior')}>
          <BehaviorPanel lesson={lesson} students={students} notes={lessonNotes} onResult={toast.show} />
        </Card>
      )}

      <Card title={t('lesson.notes')}>
        <LessonNotesEditor key={`${lesson.notes ?? ''}|${Boolean(lesson.notesDone)}`} lesson={lesson} onResult={toast.show} />
      </Card>

      <LessonEditorModal
        session={editor}
        onClose={() => setEditor((current) => ({ ...current, visible: false }))}
        onDone={({ action, message }) => {
          if (action === 'deleted') router.back();
          else toast.show(message);
        }}
      />
    </Screen>
  );
}

const useStyles = createStyles((c) => ({
  subject: { color: c.text, fontSize: 22, fontWeight: '800', textAlign: 'auto' },
  meta: { color: c.textMuted, textAlign: 'auto' },
  classLink: { color: c.primary, fontWeight: '700', textAlign: 'auto' },
  badges: { flexDirection: 'row', gap: 6 },
  headerAction: { color: c.primary, fontWeight: '700', fontSize: 12 },
  headerHint: { color: c.textSubtle, fontSize: 11, flexShrink: 1, textAlign: 'right' },
}));
