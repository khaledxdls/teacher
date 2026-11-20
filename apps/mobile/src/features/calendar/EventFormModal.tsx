import { useState } from 'react';
import Button from '../../components/ui/Button';
import DateTimeInput from '../../components/ui/DateTimeInput';
import FormModal from '../../components/ui/FormModal';
import LabeledField from '../../components/ui/LabeledField';
import TextField from '../../components/ui/TextField';
import { addDaysToKey, todayKey } from '../../domain/dates';
import { createId } from '../../domain/records';
import { CalendarEvent, CalendarEventKind } from '../../domain/types';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { usePlannerActions } from '../../state/planner';

type Props = {
  /** The event to edit, a kind to create, or null when closed. */
  target: CalendarEvent | CalendarEventKind | null;
  onClose: () => void;
  /** Asks to delete the edited event (the modal closes first). */
  onDelete: (event: CalendarEvent) => void;
};

/** Create or edit a holiday or term. */
export default function EventFormModal({ target, onClose, onDelete }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const event = typeof target === 'object' ? target : null;
  const kind = event?.kind ?? (target as CalendarEventKind | null) ?? 'holiday';
  const title = event ? t('calendar.editEvent') : t(kind === 'holiday' ? 'calendar.newHoliday' : 'calendar.newTerm');
  return (
    <FormModal visible={target !== null} title={title} onClose={onClose} toastMessage={toast.message}>
      <EventForm event={event} kind={kind} onClose={onClose} onDelete={onDelete} onError={toast.show} />
    </FormModal>
  );
}

type FormProps = Pick<Props, 'onClose' | 'onDelete'> & { event: CalendarEvent | null; kind: CalendarEventKind; onError: (message: string) => void };

function EventForm({ event, kind, onClose, onDelete, onError }: FormProps) {
  const { t, tError } = useI18n();
  const actions = usePlannerActions();
  const [title, setTitle] = useState(event?.title ?? '');
  const [startDate, setStartDate] = useState(event?.startDate ?? todayKey());
  const [endDate, setEndDate] = useState(event?.endDate ?? addDaysToKey(todayKey(), kind === 'holiday' ? 6 : 90));

  function save() {
    const result = actions.saveEvent({ id: event?.id ?? createId(), kind, title, startDate, endDate });
    if (result.ok) onClose();
    else onError(tError(result.error));
  }

  function changeStart(value: string) {
    setStartDate(value);
    if (endDate < value) setEndDate(value);
  }

  return (
    <>
      <TextField label={t('calendar.eventName')} placeholder={t('calendar.eventNamePlaceholder')} value={title} onChangeText={setTitle} autoFocus={!event} />
      <LabeledField label={t('calendar.startDate')} inline>
        <DateTimeInput mode="date" value={startDate} onChange={changeStart} accessibilityLabel={t('calendar.startDate')} />
      </LabeledField>
      <LabeledField label={t('calendar.endDate')} inline>
        <DateTimeInput mode="date" value={endDate} minimumDate={startDate} onChange={setEndDate} accessibilityLabel={t('calendar.endDate')} />
      </LabeledField>
      <Button label={t('common.save')} onPress={save} />
      {event && <Button label={t('common.delete')} variant="danger" onPress={() => { onClose(); onDelete(event); }} />}
      <Button label={t('common.cancel')} variant="text" onPress={onClose} />
    </>
  );
}
