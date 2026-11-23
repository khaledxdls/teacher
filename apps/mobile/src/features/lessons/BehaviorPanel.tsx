import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { behaviorCountsByStudent } from '../../domain/behavior';
import { BehaviorKind, BehaviorNote, ScheduleEntry, Student } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { usePlannerActions } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';

type Props = {
  lesson: ScheduleEntry;
  students: Student[];
  /** Live notes recorded in this lesson. */
  notes: BehaviorNote[];
  onResult: (message: string) => void;
};

/** Quick +/− participation and behaviour marks during a lesson. */
export default function BehaviorPanel({ lesson, students, notes, onResult }: Props) {
  const styles = useStyles();
  const { t, tError } = useI18n();
  const actions = usePlannerActions();
  const counts = useMemo(() => behaviorCountsByStudent(notes), [notes]);

  function add(student: Student, kind: BehaviorKind) {
    const result = actions.addBehaviorNote({ studentId: student.id, kind, date: lesson.date, lessonId: lesson.id });
    onResult(result.ok ? t('behavior.added', { name: student.name }) : tError(result.error));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>{t('lesson.behaviorHint')}</Text>
      {students.map((student) => {
        const count = counts.get(student.id) ?? { positive: 0, negative: 0 };
        return (
          <View key={student.id} style={styles.row}>
            <Text style={styles.name}>{student.name}</Text>
            {(count.positive > 0 || count.negative > 0) && <Text style={styles.count}>{t('behavior.counts', count)}</Text>}
            <Pressable
              style={[styles.button, styles.positive]}
              onPress={() => add(student, 'positive')}
              accessibilityRole="button"
              accessibilityLabel={t('behavior.addPositive', { name: student.name })}
            >
              <Text style={[styles.buttonText, styles.positiveText]}>＋</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.negative]}
              onPress={() => add(student, 'negative')}
              accessibilityRole="button"
              accessibilityLabel={t('behavior.addNegative', { name: student.name })}
            >
              <Text style={[styles.buttonText, styles.negativeText]}>−</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  container: { gap: 2 },
  hint: { color: c.textMuted, fontSize: 12, marginBottom: 6, textAlign: 'auto' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  name: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600', textAlign: 'auto' },
  count: { color: c.textSubtle, fontSize: 12, fontWeight: '700' },
  button: { width: 40, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  positive: { backgroundColor: c.successSoft },
  negative: { backgroundColor: c.dangerSoft },
  buttonText: { fontSize: 20, fontWeight: '800' },
  positiveText: { color: c.success },
  negativeText: { color: c.danger },
}));
