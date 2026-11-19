import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmDestructive } from '../../components/ui/confirm';
import NamePromptModal from '../../components/ui/NamePromptModal';
import Screen from '../../components/ui/Screen';
import { ScheduleTemplate } from '../../domain/schedule';
import { useToast } from '../../hooks/useToast';
import { usePlanner } from '../../state/PlannerProvider';
import { colors } from '../../theme/colors';
import { sharedStyles } from '../../theme/sharedStyles';

// The teaching week starts on Friday, so day 0 is Friday.
const DAY_NAMES = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

export default function TemplatesScreen() {
  const planner = usePlanner();
  const toast = useToast();
  const [renaming, setRenaming] = useState<ScheduleTemplate | null>(null);

  function remove(template: ScheduleTemplate) {
    const run = () => {
      planner.deleteTemplate(template.id);
      toast.show(`"${template.name}" deleted.`);
    };
    confirmDestructive('Delete template?', `"${template.name}" will be deleted. Weeks it was applied to are not changed.`, 'Delete', run);
  }

  return (
    <Screen toastMessage={toast.message}>
      <Text style={styles.hint}>Save a week from the Schedule tab, then apply it to any other week.</Text>
      {planner.templates.map((template) => {
        const days = [...new Set(template.entries.map((entry) => entry.day))].sort((a, b) => a - b);
        return (
          <View key={template.id} style={styles.card}>
            <Text style={styles.name}>{template.name}</Text>
            <Text style={styles.meta}>
              {template.entries.length} class{template.entries.length === 1 ? '' : 'es'} · {days.map((day) => DAY_NAMES[day]).join(', ') || 'no days'}
            </Text>
            {template.entries
              .slice()
              .sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime))
              .map((entry, index) => (
                <Text key={index} style={styles.entry}>
                  {DAY_NAMES[entry.day]} {entry.startTime}–{entry.endTime} · {entry.subject} · {planner.classById.get(entry.classId)?.name ?? 'Unknown class'}
                </Text>
              ))}
            <View style={styles.actions}>
              <Pressable onPress={() => setRenaming(template)} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.action}>Rename</Text>
              </Pressable>
              <Pressable onPress={() => remove(template)} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.action, styles.delete]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {planner.templates.length === 0 && <Text style={sharedStyles.emptyText}>No templates yet.</Text>}
      <NamePromptModal
        visible={renaming !== null}
        title="Rename template"
        placeholder="Template name"
        initialValue={renaming?.name ?? ''}
        onSubmit={(name) => (renaming ? planner.renameTemplate(renaming.id, name) : null)}
        onClose={() => setRenaming(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 13 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.divider },
  name: { color: colors.navy, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: 8 },
  entry: { color: colors.navy, fontSize: 13, paddingVertical: 2 },
  actions: { flexDirection: 'row', gap: 24, marginTop: 12 },
  action: { color: colors.primary, fontWeight: '800' },
  delete: { color: colors.danger },
});
