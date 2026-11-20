import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from '../../components/feedback/Toast';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ListRow from '../../components/ui/ListRow';
import { holidayOn, rotationWeek } from '../../domain/calendar';
import { dateKey, dateTimeOf, parseDateKey } from '../../domain/dates';
import { openFollowUps } from '../../domain/followUps';
import { currentEntry, entriesOn, nextEntry } from '../../domain/schedule';
import { ScheduleEntry } from '../../domain/types';
import { useNow } from '../../hooks/useNow';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { TranslationKey } from '../../i18n/translate';
import { useCalendar, useClassById, useLessons } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';
import { useTheme } from '../../theme/ThemeProvider';
import { useSharedStyles } from '../../theme/sharedStyles';
import LessonCard from '../lessons/LessonCard';
import LessonEditorModal, { EditorSession } from '../schedule/components/LessonEditorModal';

const FOLLOW_UP_PREVIEW = 3;

const greetingKey = (hour: number): TranslationKey =>
  (hour < 12 ? 'today.greetingMorning' : hour < 18 ? 'today.greetingAfternoon' : 'today.greetingEvening');

export default function TodayScreen() {
  const styles = useStyles();
  const shared = useSharedStyles();
  const router = useRouter();
  const { palette } = useTheme();
  const { t, formatDate, formatDuration } = useI18n();
  const now = useNow();
  const lessons = useLessons();
  const classById = useClassById();
  const calendar = useCalendar();
  const toast = useToast();
  const [editor, setEditor] = useState<EditorSession>(() => ({ key: 0, visible: false, date: new Date(), lesson: null }));

  const today = dateKey(now);
  const todaysLessons = useMemo(() => entriesOn(lessons, today), [lessons, today]);
  const current = currentEntry(todaysLessons, now);
  const upcoming = nextEntry(lessons, now);
  const followUps = useMemo(() => openFollowUps(lessons), [lessons]);
  const holiday = holidayOn(calendar.events, today);
  const rotation = rotationWeek(calendar.settings, today);

  const openLesson = (lesson: ScheduleEntry) =>
    setEditor((state) => ({ key: state.key + 1, visible: true, date: parseDateKey(lesson.date), lesson }));
  const className = (lesson: ScheduleEntry) => classById.get(lesson.classId)?.name ?? t('common.unknownClass');

  const featured = current ?? upcoming;
  const featuredDetail = current
    ? t('today.endsAt', { time: current.endTime })
    : upcoming && t('today.startsIn', { duration: formatDuration((dateTimeOf(upcoming.date, upcoming.startTime).getTime() - now.getTime()) / 60_000) });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style={palette.scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.greeting}>{t(greetingKey(now.getHours()))}</Text>
          <Text style={styles.date} accessibilityRole="header">{formatDate(now, 'full')}</Text>
          {rotation && <Text style={styles.rotation}>{t('today.week', { week: rotation })}</Text>}
        </View>

        {holiday && <Text style={styles.holiday}>{t('today.holiday', { title: holiday.title })}</Text>}

        {featured ? (
          <Pressable style={styles.featured} onPress={() => openLesson(featured)} accessibilityRole="button">
            <Text style={styles.featuredLabel}>{t(current ? 'today.nowLesson' : 'today.nextLesson')}</Text>
            <Text style={styles.featuredSubject}>{featured.subject}</Text>
            <Text style={styles.featuredMeta}>
              {className(featured)} · {featured.date === today ? '' : `${formatDate(featured.date, 'dayMonth')} · `}{featured.startTime}–{featured.endTime}
              {featured.room ? ` · ${t('common.room', { room: featured.room })}` : ''}
            </Text>
            <Text style={styles.featuredDetail}>{featuredDetail}</Text>
            {current && (classById.get(current.classId)?.students.length ?? 0) > 0 && (
              <Button label={t('today.takeAttendance')} variant="secondary" onPress={() => openLesson(current)} style={styles.featuredButton} />
            )}
          </Pressable>
        ) : (
          <Card><Text style={shared.hint}>{t('today.nothingUpcoming')}</Text></Card>
        )}

        <Card title={t('today.todaysLessons')}>
          {todaysLessons.map((lesson, index) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              savedClass={classById.get(lesson.classId)}
              accent={palette.accents[index % palette.accents.length]}
              highlighted={lesson.id === current?.id}
              onPress={() => openLesson(lesson)}
            />
          ))}
          {todaysLessons.length === 0 && <Text style={shared.hint}>{t('today.noLessonsToday')}</Text>}
        </Card>

        <Card
          flush
          title={t('today.followUps')}
          action={followUps.length > FOLLOW_UP_PREVIEW ? (
            <Pressable onPress={() => router.push('/follow-ups')} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.link}>{t('common.seeAll')}</Text>
            </Pressable>
          ) : undefined}
        >
          {followUps.slice(0, FOLLOW_UP_PREVIEW).map((lesson) => (
            <ListRow
              key={lesson.id}
              divider
              title={lesson.notes!.trim()}
              subtitle={t('followUps.source', { subject: lesson.subject, className: className(lesson), date: formatDate(lesson.date, 'dayMonth') })}
              onPress={() => router.push('/follow-ups')}
            />
          ))}
          {followUps.length === 0 && <Text style={[shared.hint, styles.flushPadding]}>{t('today.noFollowUps')}</Text>}
        </Card>
      </ScrollView>
      {!editor.visible && <Toast message={toast.message} />}

      <LessonEditorModal
        session={editor}
        onClose={() => setEditor((state) => ({ ...state, visible: false }))}
        onDone={toast.show}
        onManageStudents={(classId) => router.push({ pathname: '/class/[id]', params: { id: classId } })}
      />
    </SafeAreaView>
  );
}

const useStyles = createStyles((c) => ({
  safeArea: { flex: 1, backgroundColor: c.background },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  greeting: { color: c.textMuted, fontSize: 14, fontWeight: '600', textAlign: 'auto' },
  date: { color: c.text, fontSize: 26, fontWeight: '800', marginTop: 2, textAlign: 'auto' },
  rotation: { color: c.primary, fontWeight: '800', marginTop: 4, textAlign: 'auto' },
  holiday: { color: c.warning, backgroundColor: c.warningSoft, fontWeight: '700', padding: 12, borderRadius: 12, overflow: 'hidden' },
  featured: { backgroundColor: c.header, borderRadius: 18, padding: 20, gap: 4 },
  featuredLabel: { color: c.onHeaderMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', textAlign: 'auto' },
  featuredSubject: { color: c.onHeader, fontSize: 24, fontWeight: '800', textAlign: 'auto' },
  featuredMeta: { color: c.onHeaderMuted, textAlign: 'auto' },
  featuredDetail: { color: c.onHeader, fontWeight: '700', marginTop: 6, textAlign: 'auto' },
  featuredButton: { marginTop: 10 },
  link: { color: c.primary, fontWeight: '700' },
  flushPadding: { paddingHorizontal: 16, paddingBottom: 16 },
}));
