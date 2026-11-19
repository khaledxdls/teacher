import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dateKey, ScheduleEntry } from '../../../domain/schedule';
import { accentColors, colors } from '../../../theme/colors';
import { sharedStyles } from '../../../theme/sharedStyles';

type Props = {
  days: Date[];
  entries: ScheduleEntry[];
  todayKey: string;
  onOpenEntry: (date: Date, entry: ScheduleEntry) => void;
  onAddToDay: (date: Date) => void;
};

export default function WeekView({ days, entries, todayKey, onOpenEntry, onAddToDay }: Props) {
  return (
    <>
      {days.map((day) => {
        const key = dateKey(day);
        const isToday = key === todayKey;
        const dayEntries = entries.filter((entry) => entry.date === key);
        return (
          <View key={key} style={[styles.dayRow, isToday && styles.todayRow]}>
            <View style={styles.dayLabel}>
              <Text style={styles.dayName}>{day.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}</Text>
              <Text style={[styles.dayNumber, isToday && styles.todayNumber]}>{day.getDate()}</Text>
            </View>
            <View style={styles.dayEntries}>
              {dayEntries.map((entry, index) => (
                <Pressable
                  key={entry.id}
                  onPress={() => onOpenEntry(day, entry)}
                  style={[styles.classCard, { borderLeftColor: accentColors[index % accentColors.length] }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.subject}, ${entry.startTime} to ${entry.endTime}`}
                >
                  <View style={styles.classCardTop}>
                    <Text style={styles.classTime}>{entry.startTime} – {entry.endTime}</Text>
                    {entry.notes ? <Text style={styles.noteBadge}>NOTE</Text> : null}
                  </View>
                  <Text style={sharedStyles.classSubject}>{entry.subject}</Text>
                  <Text style={sharedStyles.classMeta}>{entry.className}{entry.room ? `  ·  Room ${entry.room}` : ''}</Text>
                </Pressable>
              ))}
              {dayEntries.length === 0 && <Text style={styles.emptyDay}>No classes planned</Text>}
              <Pressable onPress={() => onAddToDay(day)} accessibilityRole="button">
                <Text style={styles.addDay}>＋ Add class</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', marginBottom: 12, borderRadius: 14, paddingVertical: 5 },
  todayRow: { backgroundColor: colors.todaySoft },
  dayLabel: { width: 52, alignItems: 'center', paddingTop: 8 },
  dayName: { color: colors.textSubtle, fontSize: 11, fontWeight: '700' },
  dayNumber: { color: colors.navy, fontSize: 20, fontWeight: '800', marginTop: 4 },
  todayNumber: { color: colors.primary },
  dayEntries: { flex: 1, marginLeft: 8 },
  classCard: { backgroundColor: colors.surface, borderRadius: 12, borderLeftWidth: 4, padding: 12, marginBottom: 7, shadowColor: colors.navy, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  classCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteBadge: { color: colors.purple, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  classTime: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  emptyDay: { color: colors.textFaint, fontSize: 12, paddingVertical: 9 },
  addDay: { color: colors.primary, padding: 9, fontWeight: '700' },
});
