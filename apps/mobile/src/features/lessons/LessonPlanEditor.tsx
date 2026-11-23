import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import Button from '../../components/ui/Button';
import DateTimeInput from '../../components/ui/DateTimeInput';
import LabeledField from '../../components/ui/LabeledField';
import TextField from '../../components/ui/TextField';
import { normalizeUrl } from '../../domain/commands';
import { addDaysToKey } from '../../domain/dates';
import { createId } from '../../domain/records';
import { LessonResource, ScheduleEntry } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { usePlannerActions } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';
import { useSharedStyles } from '../../theme/sharedStyles';

type Props = { lesson: ScheduleEntry; onResult: (message: string) => void };

const blankLink = (): LessonResource => ({ id: createId(), label: '', url: '' });

/** Objectives, links and homework for one lesson. */
export default function LessonPlanEditor({ lesson, onResult }: Props) {
  const styles = useStyles();
  const shared = useSharedStyles();
  const { t, tError } = useI18n();
  const actions = usePlannerActions();
  const plan = lesson.plan ?? {};
  const [objectives, setObjectives] = useState(plan.objectives ?? '');
  const [links, setLinks] = useState<LessonResource[]>(plan.resources?.length ? plan.resources : []);
  const [homework, setHomework] = useState(plan.homework ?? '');
  const [homeworkDue, setHomeworkDue] = useState(plan.homeworkDue ?? addDaysToKey(lesson.date, 7));

  const updateLink = (id: string, patch: Partial<LessonResource>) =>
    setLinks((current) => current.map((link) => (link.id === id ? { ...link, ...patch } : link)));

  function save() {
    const result = actions.saveLessonPlan({ lessonId: lesson.id, plan: { objectives, resources: links, homework, homeworkDue } });
    onResult(result.ok ? t('lesson.planSaved') : tError(result.error));
  }

  return (
    <View style={styles.container}>
      <TextField
        label={t('lesson.objectives')}
        placeholder={t('lesson.objectivesPlaceholder')}
        value={objectives}
        onChangeText={setObjectives}
        multiline
        style={styles.multiline}
        textAlignVertical="top"
      />

      <Text style={shared.fieldLabel}>{t('lesson.links')}</Text>
      {links.map((link) => (
        <View key={link.id} style={styles.linkRow}>
          <View style={styles.linkFields}>
            <TextField placeholder={t('lesson.linkLabel')} value={link.label} onChangeText={(label) => updateLink(link.id, { label })} />
            <TextField
              placeholder={t('lesson.linkUrl')}
              value={link.url}
              onChangeText={(url) => updateLink(link.id, { url })}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
          {normalizeUrl(link.url) && (
            <Pressable
              onPress={() => void Linking.openURL(normalizeUrl(link.url)!)}
              accessibilityRole="link"
              accessibilityLabel={t('lesson.openLink', { label: link.label || link.url })}
              hitSlop={8}
            >
              <Text style={styles.open}>↗</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setLinks((current) => current.filter((item) => item.id !== link.id))}
            accessibilityRole="button"
            accessibilityLabel={t('lesson.removeLink')}
            hitSlop={8}
          >
            <Text style={styles.remove}>×</Text>
          </Pressable>
        </View>
      ))}
      <Button variant="text" label={t('lesson.addLink')} onPress={() => setLinks((current) => [...current, blankLink()])} />

      <TextField
        label={t('lesson.homework')}
        placeholder={t('lesson.homeworkPlaceholder')}
        value={homework}
        onChangeText={setHomework}
        multiline
        style={styles.multiline}
        textAlignVertical="top"
      />
      {homework.trim() !== '' && (
        <LabeledField label={t('lesson.homeworkDue')} inline>
          <DateTimeInput mode="date" value={homeworkDue} minimumDate={lesson.date} onChange={setHomeworkDue} accessibilityLabel={t('lesson.homeworkDue')} />
        </LabeledField>
      )}
      <Button label={t('lesson.savePlan')} variant="secondary" onPress={save} />
    </View>
  );
}

const useStyles = createStyles((c) => ({
  container: { gap: 4 },
  multiline: { minHeight: 70 },
  open: { color: c.primary, fontSize: 22, fontWeight: '800', paddingTop: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  linkFields: { flex: 1 },
  remove: { color: c.danger, fontSize: 24, paddingTop: 8 },
}));
