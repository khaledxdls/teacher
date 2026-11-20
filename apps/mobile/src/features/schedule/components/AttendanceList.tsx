import { Pressable, Text, View } from 'react-native';
import { markAllPresent, nextAttendanceStatus } from '../../../domain/attendance';
import { AttendanceStatus, Student } from '../../../domain/types';
import { useI18n } from '../../../i18n/I18nProvider';
import { createStyles } from '../../../theme/createStyles';

type Props = {
  students: Student[];
  attendance: Record<string, AttendanceStatus>;
  onChange: (attendance: Record<string, AttendanceStatus>) => void;
};

/** Tap a student to cycle: not marked → present → late → absent → not marked. */
export default function AttendanceList({ students, attendance, onChange }: Props) {
  const styles = useStyles();
  const { t } = useI18n();

  function cycle(studentId: string) {
    const next = nextAttendanceStatus(attendance[studentId]);
    const updated = { ...attendance };
    if (next) updated[studentId] = next;
    else delete updated[studentId];
    onChange(updated);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('attendance.title')}</Text>
        <Pressable onPress={() => onChange(markAllPresent(students))} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.allPresent}>{t('attendance.markAllPresent')}</Text>
        </Pressable>
      </View>
      {students.map((student) => {
        const status = attendance[student.id];
        const label = status ? t(`attendance.${status}`) : t('attendance.notMarked');
        return (
          <Pressable
            key={student.id}
            style={styles.row}
            onPress={() => cycle(student.id)}
            accessibilityRole="button"
            accessibilityLabel={t('attendance.a11y', { name: student.name, status: label })}
          >
            <Text style={styles.name}>{student.name}</Text>
            <Text style={[styles.status, status ? styles[status] : styles.unmarked]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  container: { borderWidth: 1, borderColor: c.border, borderRadius: 10, marginBottom: 12, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: c.surfaceMuted },
  title: { color: c.text, fontWeight: '800' },
  allPresent: { color: c.primary, fontWeight: '700', fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.divider, gap: 8 },
  name: { color: c.text, fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'auto' },
  status: { fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  present: { backgroundColor: c.successSoft, color: c.success },
  late: { backgroundColor: c.warningSoft, color: c.warning },
  absent: { backgroundColor: c.dangerSoft, color: c.danger },
  unmarked: { backgroundColor: c.surfaceMuted, color: c.textSubtle },
}));
