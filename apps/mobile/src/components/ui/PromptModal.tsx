import { useState } from 'react';
import { TextInputProps } from 'react-native';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import Button from './Button';
import FormModal from './FormModal';
import TextField from './TextField';

export type PromptField = {
  name: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  inputProps?: TextInputProps;
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  fields: PromptField[];
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  /** Returns an error message to keep the dialog open, or null to close it. May be async. */
  onSubmit: (values: Record<string, string>) => string | null | Promise<string | null>;
  onClose: () => void;
};

/** A dialog with one or more text fields (Alert.prompt only exists on iOS). */
export default function PromptModal({ visible, title, message, fields, confirmLabel, confirmVariant = 'primary', onSubmit, onClose }: Props) {
  const toast = useToast();
  return (
    <FormModal visible={visible} title={title} subtitle={message} onClose={onClose} toastMessage={toast.message}>
      <PromptForm fields={fields} confirmLabel={confirmLabel} confirmVariant={confirmVariant} onSubmit={onSubmit} onClose={onClose} onError={toast.show} />
    </FormModal>
  );
}

type FormProps = Pick<Props, 'fields' | 'confirmLabel' | 'confirmVariant' | 'onSubmit' | 'onClose'> & { onError: (message: string) => void };

function PromptForm({ fields, confirmLabel, confirmVariant, onSubmit, onClose, onError }: FormProps) {
  const { t } = useI18n();
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field.name, field.initialValue ?? ''])));
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const error = await onSubmit(values);
      if (error) onError(error);
      else onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {fields.map((field, index) => (
        <TextField
          key={field.name}
          label={field.label}
          placeholder={field.placeholder}
          value={values[field.name]}
          onChangeText={(text) => setValues((current) => ({ ...current, [field.name]: text }))}
          onSubmitEditing={index === fields.length - 1 ? () => void submit() : undefined}
          returnKeyType={index === fields.length - 1 ? 'done' : 'next'}
          autoFocus={index === 0}
          {...field.inputProps}
        />
      ))}
      <Button label={confirmLabel ?? t('common.save')} variant={confirmVariant} onPress={() => void submit()} loading={busy} />
      <Button label={t('common.cancel')} variant="text" onPress={onClose} />
    </>
  );
}
