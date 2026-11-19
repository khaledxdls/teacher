import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/ui/Button';
import NamePromptModal from '../../components/ui/NamePromptModal';
import Screen from '../../components/ui/Screen';
import { dateKey, sameName } from '../../domain/schedule';
import { useToast } from '../../hooks/useToast';
import { usePlanner } from '../../state/PlannerProvider';
import { colors } from '../../theme/colors';
import { sharedStyles } from '../../theme/sharedStyles';

export default function ClassesScreen() {
  const planner = usePlanner();
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);

  const upcomingByClass = useMemo(() => {
    const today = dateKey(new Date());
    const counts = new Map<string, number>();
    for (const entry of planner.entries) {
      if (entry.date >= today) counts.set(entry.classId, (counts.get(entry.classId) ?? 0) + 1);
    }
    return counts;
  }, [planner.entries]);

  return (
    <Screen toastMessage={toast.message}>
      <Button label="＋ New class" onPress={() => setCreating(true)} />
      {planner.classes.map((item) => {
        const upcoming = upcomingByClass.get(item.id) ?? 0;
        return (
          <Pressable
            key={item.id}
            style={styles.card}
            onPress={() => router.push({ pathname: '/class/[id]', params: { id: item.id } })}
            accessibilityRole="button"
          >
            <View style={styles.cardText}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.students.length} student{item.students.length === 1 ? '' : 's'} · {upcoming} upcoming class{upcoming === 1 ? '' : 'es'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        );
      })}
      {planner.classes.length === 0 && (
        <Text style={sharedStyles.emptyText}>No classes yet. Create one here or while adding a class to your schedule.</Text>
      )}
      <NamePromptModal
        visible={creating}
        title="New class"
        placeholder="Class name, e.g. 7B"
        confirmLabel="Create"
        onSubmit={(name) => {
          if (!name.trim()) return 'Enter a class name first.';
          if (planner.classes.some((item) => sameName(item.name, name))) return 'A class with this name already exists.';
          planner.addClass(name);
          return null;
        }}
        onClose={() => setCreating(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.divider },
  cardText: { flex: 1 },
  name: { color: colors.navy, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  chevron: { color: colors.textFaint, fontSize: 28 },
});
