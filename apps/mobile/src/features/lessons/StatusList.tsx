import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Student } from '../../domain/types';
import { createStyles } from '../../theme/createStyles';

export type StatusTone = 'success' | 'warning' | 'danger';

type Props<S extends string> = {
  title: string;
  students: Pick<Student, 'id' | 'name'>[];
  statusOf: (studentId: string) => S | undefined;
  /** The status after a tap (undefined clears it). */
  next: (current: S | undefined) => S | undefined;
  onChange: (studentId: string, status: S | undefined) => void;
  label: (status: S | undefined) => string;
  tone: Record<S, StatusTone>;
  /** e.g. "Mark all present". */
  headerAction?: ReactNode;
  accessibilityLabel: (name: string, statusLabel: string) => string;
};

/** One row per student; tapping cycles the student's status (attendance, homework…). */
export default function StatusList<S extends string>({ title, students, statusOf, next, onChange, label, tone, headerAction, accessibilityLabel }: Props<S>) {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {headerAction}
      </View>
      {students.map((student) => {
        const status = statusOf(student.id);
        const statusLabel = label(status);
        return (
          <Pressable
            key={student.id}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => onChange(student.id, next(status))}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel(student.name, statusLabel)}
          >
            <Text style={styles.name}>{student.name}</Text>
            <Text style={[styles.status, status ? styles[tone[status]] : styles.unmarked]}>{statusLabel}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((c) => ({
  container: { borderWidth: 1, borderColor: c.border, borderRadius: 12, overflow: 'hidden', backgroundColor: c.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: c.surfaceMuted, gap: 8 },
  title: { color: c.text, fontWeight: '800', flexShrink: 1, textAlign: 'auto' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: c.divider, gap: 8 },
  pressed: { backgroundColor: c.surfaceMuted },
  name: { color: c.text, fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'auto' },
  status: { fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  success: { backgroundColor: c.successSoft, color: c.success },
  warning: { backgroundColor: c.warningSoft, color: c.warning },
  danger: { backgroundColor: c.dangerSoft, color: c.danger },
  unmarked: { backgroundColor: c.surfaceMuted, color: c.textSubtle },
}));
