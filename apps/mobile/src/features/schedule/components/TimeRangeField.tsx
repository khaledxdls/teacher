import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { defaultEndTime, formatTime, timeToDate, timeToMinutes } from '../../../domain/schedule';
import { colors } from '../../../theme/colors';

type TimeRange = { startTime: string; endTime: string };
type Props = TimeRange & { onChange: (range: TimeRange) => void };
type Field = 'start' | 'end';

// Android shows the picker as a dialog that closes itself after each pick.
// iOS renders it inline and fires onChange on every wheel movement, so it stays
// open until the user taps "Done" (or the same field again).
const isIOS = Platform.OS === 'ios';

export default function TimeRangeField({ startTime, endTime, onChange }: Props) {
  const [active, setActive] = useState<Field | null>(null);

  function update(field: Field, time: string) {
    if (field === 'end') {
      onChange({ startTime, endTime: time });
      return;
    }
    const pushEnd = timeToMinutes(endTime) <= timeToMinutes(time);
    onChange({ startTime: time, endTime: pushEnd ? defaultEndTime(time) : endTime });
  }

  function handleChange(event: DateTimePickerEvent, value?: Date) {
    const field = active;
    if (!isIOS) setActive(null);
    if (event.type !== 'set' || !value || !field) return;
    update(field, formatTime(value));
  }

  const toggle = (field: Field) => setActive((current) => (current === field ? null : field));

  return (
    <>
      <View style={styles.row}>
        <TimeButton label="Starts" value={startTime} selected={active === 'start'} onPress={() => toggle('start')} />
        <Text style={styles.separator}>to</Text>
        <TimeButton label="Ends" value={endTime} selected={active === 'end'} onPress={() => toggle('end')} />
      </View>
      {active && (
        <View style={isIOS ? styles.inlinePicker : undefined}>
          <DateTimePicker
            value={timeToDate(active === 'start' ? startTime : endTime)}
            mode="time"
            display={isIOS ? 'spinner' : 'clock'}
            onChange={handleChange}
          />
          {isIOS && (
            <Pressable style={styles.doneButton} onPress={() => setActive(null)} accessibilityRole="button">
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          )}
        </View>
      )}
    </>
  );
}

type TimeButtonProps = { label: string; value: string; selected: boolean; onPress: () => void };

function TimeButton({ label, value, selected, onPress }: TimeButtonProps) {
  return (
    <Pressable
      style={[styles.timeButton, selected && styles.timeButtonSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} at ${value}`}
    >
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={styles.timeValue}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  timeButton: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 11 },
  timeButtonSelected: { borderColor: colors.primary },
  timeLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: '700' },
  timeValue: { color: colors.navy, fontSize: 20, fontWeight: '800', marginTop: 3 },
  separator: { color: colors.textSubtle, marginHorizontal: 10 },
  inlinePicker: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  doneButton: { alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  doneText: { color: colors.primary, fontWeight: '800' },
});
