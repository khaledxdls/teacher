import { Text } from 'react-native';
import Button from '../../components/ui/Button';
import FormModal from '../../components/ui/FormModal';
import ListRow from '../../components/ui/ListRow';
import { ScheduleTemplate } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useSharedStyles } from '../../theme/sharedStyles';

type Props = {
  visible: boolean;
  templates: ScheduleTemplate[];
  weekLabel: string;
  onPick: (template: ScheduleTemplate) => void;
  onClose: () => void;
};

export default function TemplatePickerModal({ visible, templates, weekLabel, onPick, onClose }: Props) {
  const shared = useSharedStyles();
  const { t } = useI18n();
  return (
    <FormModal visible={visible} title={t('templates.applyTitle')} subtitle={weekLabel} onClose={onClose}>
      <Text style={shared.hint}>{t('templates.applyWarning')}</Text>
      {templates.map((template, index) => (
        <ListRow
          key={template.id}
          title={template.name}
          subtitle={t('templates.lessons', { count: template.entries.length })}
          onPress={() => onPick(template)}
          divider={index > 0}
        />
      ))}
      {templates.length === 0 && <Text style={shared.emptyText}>{t('errors.templateMissing')}</Text>}
      <Button label={t('common.cancel')} variant="text" onPress={onClose} />
    </FormModal>
  );
}
