import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AttendanceStatus, nextAttendanceStatus, Student } from '../../../domain/schedule';
import { colors } from '../../../theme/colors';

type Props = {
  students: Student[];
  attendance: Record<string, AttendanceStatus>;
  onChange: (attendance: Record<string, AttendanceStatus>) => void;
};

const LABELS: Record<AttendanceStatus, string> = { present: 'Present', late: 'Late', absent: 'Absent' };
const STATUS_COLORS: Record<AttendanceStatus, { background: string; text: string }> = {
  present: { background: '#e3f7ec', text: '#13894a' },
  late: { background: '#fff4d6', text: '#a87400' },
  absent: { background: '#fde6ea', text: colors.danger },
};

/** Tap a student to cycle: unmarked → present → late → absent → unmarked. */
export default function AttendanceList({ students, attendance, onChange }: Props) {
  function cycle(studentId: string) {
    const next = nextAttendanceStatus(attendance[studentId]);
    const updated = { ...attendance };
    if (next) updated[studentId] = next;
    else delete updated[studentId];
    onChange(updated);
  }

  function markAllPresent() {
    onChange(Object.fromEntries(students.map((student) => [student.id, 'present' as const])));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance</Text>
        <Pressable onPress={markAllPresent} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.allPresent}>Mark all present</Text>
        </Pressable>
      </View>
      {students.map((student) => {
        const status = attendance[student.id];
        return (
          <Pressable
            key={student.id}
            style={styles.row}
            onPress={() => cycle(student.id)}
            accessibilityRole="button"
            accessibilityLabel={`${student.name}: ${status ? LABELS[status] : 'not marked'}. Tap to change.`}
          >
            <Text style={styles.name}>{student.name}</Text>
            <Text
              style={[
                styles.status,
                status ? { backgroundColor: STATUS_COLORS[status].background, color: STATUS_COLORS[status].text } : styles.unmarked,
              ]}
            >
              {status ? LABELS[status] : 'Not marked'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginBottom: 12, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: colors.surfaceMuted },
  title: { color: colors.navy, fontWeight: '800' },
  allPresent: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.divider },
  name: { color: colors.navy, fontSize: 15, fontWeight: '600', flex: 1 },
  status: { fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  unmarked: { backgroundColor: colors.closeButton, color: colors.textSubtle },
});
