import { Pressable, Text, View } from 'react-native';
import { SavedClass, ScheduleEntry } from '../../../domain/types';
import { useI18n } from '../../../i18n/I18nProvider';
import { createStyles } from '../../../theme/createStyles';
import { useSharedStyles } from '../../../theme/sharedStyles';

type Props = {
  lessons: ScheduleEntry[];
  classById: Map<string, SavedClass>;
  onOpenLesson: (lesson: ScheduleEntry) => void;
};

export default function MonthView({ lessons, classById, onOpenLesson }: Props) {
  const styles = useStyles();
  const shared = useSharedStyles();
  const { t, formatDate } = useI18n();
  return (
    <View style={styles.list}>
      {lessons.map((lesson) => (
        <Pressable key={lesson.id} onPress={() => onOpenLesson(lesson)} style={styles.item} accessibilityRole="button">
          <Text style={styles.date}>{formatDate(lesson.date, 'weekdayDay')}</Text>
          <View style={styles.text}>
            <Text style={shared.lessonSubject}>{lesson.subject}</Text>
            <Text style={shared.lessonMeta}>{lesson.startTime} · {classById.get(lesson.classId)?.name ?? t('common.unknownClass')}</Text>
          </View>
        </Pressable>
      ))}
      {lessons.length === 0 && <Text style={shared.emptyText}>{t('schedule.noLessonsMonth')}</Text>}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  list: { gap: 9 },
  item: { backgroundColor: c.surface, padding: 14, borderRadius: 12, flexDirection: 'row', gap: 14 },
  date: { width: 90, color: c.primary, fontWeight: '800', textAlign: 'auto' },
  text: { flex: 1 },
}));
