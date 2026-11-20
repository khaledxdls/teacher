import { Pressable, Text, View } from 'react-native';
import { holidayOn } from '../../../domain/calendar';
import { dateKey } from '../../../domain/dates';
import { CalendarEvent, SavedClass, ScheduleEntry } from '../../../domain/types';
import { useI18n } from '../../../i18n/I18nProvider';
import { createStyles } from '../../../theme/createStyles';
import { useTheme } from '../../../theme/ThemeProvider';
import LessonCard from '../../lessons/LessonCard';

type Props = {
  days: Date[];
  lessons: ScheduleEntry[];
  classById: Map<string, SavedClass>;
  events: CalendarEvent[];
  today: string;
  onOpenLesson: (date: Date, lesson: ScheduleEntry) => void;
  onAddToDay: (date: Date) => void;
};

export default function WeekView({ days, lessons, classById, events, today, onOpenLesson, onAddToDay }: Props) {
  const styles = useStyles();
  const { palette } = useTheme();
  const { t, formatDate } = useI18n();

  return (
    <>
      {days.map((day) => {
        const key = dateKey(day);
        const isToday = key === today;
        const holiday = holidayOn(events, key);
        const dayLessons = lessons.filter((lesson) => lesson.date === key);
        return (
          <View key={key} style={[styles.dayRow, isToday && styles.todayRow]}>
            <View style={styles.dayLabel}>
              <Text style={styles.dayName}>{formatDate(day, 'weekday').toUpperCase()}</Text>
              <Text style={[styles.dayNumber, isToday && styles.todayNumber]}>{day.getDate()}</Text>
            </View>
            <View style={styles.dayLessons}>
              {holiday && <Text style={styles.holiday}>{t('schedule.holiday', { title: holiday.title })}</Text>}
              {dayLessons.map((lesson, index) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  savedClass={classById.get(lesson.classId)}
                  accent={palette.accents[index % palette.accents.length]}
                  onPress={() => onOpenLesson(day, lesson)}
                />
              ))}
              {dayLessons.length === 0 && !holiday && <Text style={styles.empty}>{t('schedule.noLessonsDay')}</Text>}
              <Pressable onPress={() => onAddToDay(day)} accessibilityRole="button">
                <Text style={styles.add}>{t('schedule.addToDay')}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </>
  );
}

const useStyles = createStyles((c) => ({
  dayRow: { flexDirection: 'row', marginBottom: 12, borderRadius: 14, paddingVertical: 5 },
  todayRow: { backgroundColor: c.surfaceHighlight },
  dayLabel: { width: 52, alignItems: 'center', paddingTop: 8 },
  dayName: { color: c.textSubtle, fontSize: 11, fontWeight: '700' },
  dayNumber: { color: c.text, fontSize: 20, fontWeight: '800', marginTop: 4 },
  todayNumber: { color: c.primary },
  dayLessons: { flex: 1, marginStart: 8, marginEnd: 4 },
  holiday: { color: c.warning, backgroundColor: c.warningSoft, fontWeight: '700', fontSize: 12, padding: 8, borderRadius: 8, marginBottom: 7, overflow: 'hidden' },
  empty: { color: c.textFaint, fontSize: 12, paddingVertical: 9, textAlign: 'auto' },
  add: { color: c.primary, padding: 9, fontWeight: '700', textAlign: 'auto' },
}));
