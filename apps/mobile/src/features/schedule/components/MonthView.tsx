import { Pressable, StyleSheet, Text, View } from 'react-native';
import { parseDateKey, SavedClass, ScheduleEntry } from '../../../domain/schedule';
import { colors } from '../../../theme/colors';
import { sharedStyles } from '../../../theme/sharedStyles';

type Props = {
  entries: ScheduleEntry[];
  classById: Map<string, SavedClass>;
  onOpenEntry: (date: Date, entry: ScheduleEntry) => void;
};

export default function MonthView({ entries, classById, onOpenEntry }: Props) {
  return (
    <View style={styles.list}>
      {entries.map((entry) => {
        const date = parseDateKey(entry.date);
        return (
          <Pressable key={entry.id} onPress={() => onOpenEntry(date, entry)} style={styles.item} accessibilityRole="button">
            <Text style={styles.date}>{date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</Text>
            <View>
              <Text style={sharedStyles.classSubject}>{entry.subject}</Text>
              <Text style={sharedStyles.classMeta}>{entry.startTime} · {classById.get(entry.classId)?.name ?? 'Unknown class'}</Text>
            </View>
          </Pressable>
        );
      })}
      {entries.length === 0 && <Text style={sharedStyles.emptyText}>No classes planned this month.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 9 },
  item: { backgroundColor: colors.surface, padding: 14, borderRadius: 12, flexDirection: 'row', gap: 14 },
  date: { width: 90, color: colors.primary, fontWeight: '800' },
});
