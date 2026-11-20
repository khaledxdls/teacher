import { Pressable, Text, View } from 'react-native';
import Badge from '../../components/ui/Badge';
import { attendanceSummary } from '../../domain/attendance';
import { hasOpenFollowUp } from '../../domain/followUps';
import { isRepeating } from '../../domain/recurrence';
import { SavedClass, ScheduleEntry } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { createStyles } from '../../theme/createStyles';
import { useSharedStyles } from '../../theme/sharedStyles';

type Props = {
  lesson: ScheduleEntry;
  savedClass: SavedClass | undefined;
  accent: string;
  onPress: () => void;
  /** Highlights the card (e.g. the lesson happening now). */
  highlighted?: boolean;
};

/** A lesson in a list: time, badges, subject, class and room. */
export default function LessonCard({ lesson, savedClass, accent, onPress, highlighted }: Props) {
  const styles = useStyles();
  const shared = useSharedStyles();
  const { t } = useI18n();
  const students = savedClass?.students ?? [];
  const summary = attendanceSummary(lesson, students);
  const marked = students.length - summary.unmarked;
  const className = savedClass?.name ?? t('common.unknownClass');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderStartColor: accent }, highlighted && styles.highlighted, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('schedule.lessonA11y', { subject: lesson.subject, start: lesson.startTime, end: lesson.endTime })}
    >
      <View style={styles.top}>
        <Text style={styles.time}>{lesson.startTime} – {lesson.endTime}</Text>
        <View style={styles.badges}>
          {marked > 0 && <Badge tone="success" label={t('schedule.badgeAttendance', { present: summary.present + summary.late, total: students.length })} />}
          {isRepeating(lesson) && <Badge tone="primary" label={t('schedule.badgeRepeats')} />}
          {hasOpenFollowUp(lesson) && <Badge tone="purple" label={t('schedule.badgeNote')} />}
        </View>
      </View>
      <Text style={shared.lessonSubject}>{lesson.subject}</Text>
      <Text style={shared.lessonMeta}>
        {className}{lesson.room ? `  ·  ${t('common.room', { room: lesson.room })}` : ''}
      </Text>
    </Pressable>
  );
}

const useStyles = createStyles((c) => ({
  card: {
    backgroundColor: c.surface, borderRadius: 12, borderStartWidth: 4, padding: 12, marginBottom: 7,
    shadowColor: c.shadow, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  highlighted: { backgroundColor: c.surfaceHighlight },
  pressed: { opacity: 0.8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badges: { flexDirection: 'row', gap: 6, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
  time: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
}));
