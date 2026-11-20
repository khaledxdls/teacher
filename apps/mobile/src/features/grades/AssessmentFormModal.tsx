import { useState } from 'react';
import Button from '../../components/ui/Button';
import DateTimeInput from '../../components/ui/DateTimeInput';
import FormModal from '../../components/ui/FormModal';
import LabeledField from '../../components/ui/LabeledField';
import TextField from '../../components/ui/TextField';
import { todayKey } from '../../domain/dates';
import { parseScore } from '../../domain/grades';
import { createId } from '../../domain/records';
import { Assessment } from '../../domain/types';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { usePlannerActions } from '../../state/planner';

type Props = {
  visible: boolean;
  classId: string;
  /** The assessment to edit, or undefined to create one. */
  assessment?: Assessment;
  onClose: () => void;
  onSaved?: (assessment: Assessment) => void;
};

/** Create or edit an assessment's title, date and maximum score. */
export default function AssessmentFormModal({ visible, classId, assessment, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <FormModal visible={visible} title={t(assessment ? 'grades.editTitle' : 'grades.newTitle')} onClose={onClose} toastMessage={toast.message}>
      <AssessmentForm classId={classId} assessment={assessment} onClose={onClose} onSaved={onSaved} onError={toast.show} />
    </FormModal>
  );
}

function AssessmentForm({ classId, assessment, onClose, onSaved, onError }: Omit<Props, 'visible'> & { onError: (message: string) => void }) {
  const { t, tError } = useI18n();
  const actions = usePlannerActions();
  const [title, setTitle] = useState(assessment?.title ?? '');
  const [date, setDate] = useState(assessment?.date ?? todayKey());
  const [maxScore, setMaxScore] = useState(String(assessment?.maxScore ?? 20));

  function save() {
    const max = parseScore(maxScore);
    if (typeof max !== 'number') {
      onError(tError({ code: 'assessmentMaxInvalid' }));
      return;
    }
    const result = actions.saveAssessment({ id: assessment?.id ?? createId(), classId, title, date, maxScore: max, scores: assessment?.scores ?? {} });
    if (!result.ok) {
      onError(tError(result.error));
      return;
    }
    onClose();
    onSaved?.(result.value);
  }

  return (
    <>
      <TextField label={t('grades.name')} placeholder={t('grades.namePlaceholder')} value={title} onChangeText={setTitle} autoFocus={!assessment} />
      <LabeledField label={t('grades.date')} inline>
        <DateTimeInput mode="date" value={date} onChange={setDate} accessibilityLabel={t('grades.date')} />
      </LabeledField>
      <TextField label={t('grades.maxScore')} value={maxScore} onChangeText={setMaxScore} keyboardType="decimal-pad" />
      <Button label={t('common.save')} onPress={save} />
      <Button label={t('common.cancel')} variant="text" onPress={onClose} />
    </>
  );
}
