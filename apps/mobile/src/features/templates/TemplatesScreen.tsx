import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Card from '../../components/ui/Card';
import PromptModal from '../../components/ui/PromptModal';
import Screen from '../../components/ui/Screen';
import { addDays } from '../../domain/dates';
import { templateDays } from '../../domain/templates';
import { ScheduleTemplate } from '../../domain/types';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { useClassById, usePlannerActions, useTemplates } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';
import { useSharedStyles } from '../../theme/sharedStyles';

/** Any Friday works: template day 0 is the first day of the teaching week. */
const REFERENCE_FRIDAY = new Date(2026, 0, 2);

export default function TemplatesScreen() {
  const styles = useStyles();
  const shared = useSharedStyles();
  const { t, tError, formatDate } = useI18n();
  const templates = useTemplates();
  const classById = useClassById();
  const actions = usePlannerActions();
  const confirm = useConfirm();
  const toast = useToast();
  const feedback = useActionFeedback(toast.show);
  const [renaming, setRenaming] = useState<ScheduleTemplate | null>(null);

  const dayName = (day: number) => formatDate(addDays(REFERENCE_FRIDAY, day), 'weekday');

  const remove = (template: ScheduleTemplate) =>
    confirm(t('templates.deleteTitle'), t('templates.deleteMessage', { name: template.name }), t('common.delete'), () =>
      feedback(actions.deleteTemplate({ id: template.id }), t('templates.deleted', { name: template.name })));

  return (
    <Screen toastMessage={toast.message}>
      <Text style={shared.hint}>{t('templates.hint')}</Text>
      {templates.map((template) => (
        <Card key={template.id} title={template.name}>
          <Text style={shared.subtitle}>
            {t('templates.lessons', { count: template.entries.length })} · {templateDays(template).map(dayName).join(', ')}
          </Text>
          {template.entries
            .slice()
            .sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime))
            .map((entry, index) => (
              <Text key={index} style={styles.entry}>
                {dayName(entry.day)} {entry.startTime}–{entry.endTime} · {entry.subject} · {classById.get(entry.classId)?.name ?? t('common.unknownClass')}
              </Text>
            ))}
          <View style={styles.actions}>
            <Pressable onPress={() => setRenaming(template)} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.action}>{t('common.rename')}</Text>
            </Pressable>
            <Pressable onPress={() => remove(template)} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.action, styles.delete]}>{t('common.delete')}</Text>
            </Pressable>
          </View>
        </Card>
      ))}
      {templates.length === 0 && <Text style={shared.emptyText}>{t('templates.empty')}</Text>}
      <PromptModal
        visible={renaming !== null}
        title={t('templates.renameTitle')}
        fields={[{ name: 'name', placeholder: t('templates.namePlaceholder'), initialValue: renaming?.name }]}
        onSubmit={({ name }) => {
          if (!renaming) return null;
          const result = actions.renameTemplate({ id: renaming.id, name });
          return result.ok ? null : tError(result.error);
        }}
        onClose={() => setRenaming(null)}
      />
    </Screen>
  );
}

const useStyles = createStyles((c) => ({
  entry: { color: c.text, fontSize: 13, paddingVertical: 2, textAlign: 'auto' },
  actions: { flexDirection: 'row', gap: 24, marginTop: 8 },
  action: { color: c.primary, fontWeight: '800' },
  delete: { color: c.danger },
}));
