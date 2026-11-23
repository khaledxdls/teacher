import { useState } from 'react';
import { Switch, View } from 'react-native';
import Button from '../../components/ui/Button';
import LabeledField from '../../components/ui/LabeledField';
import TextField from '../../components/ui/TextField';
import { ScheduleEntry } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { usePlannerActions } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';
import { useTheme } from '../../theme/ThemeProvider';

type Props = { lesson: ScheduleEntry; onResult: (message: string) => void };

/** After-class notes; open notes appear in the follow-ups list until marked done. */
export default function LessonNotesEditor({ lesson, onResult }: Props) {
  const styles = useStyles();
  const { palette } = useTheme();
  const { t, tError } = useI18n();
  const actions = usePlannerActions();
  const [notes, setNotes] = useState(lesson.notes ?? '');
  const [done, setDone] = useState(Boolean(lesson.notesDone));

  function save() {
    const result = actions.updateLessonNotes({ id: lesson.id, notes, notesDone: done });
    onResult(result.ok ? t('lesson.notesSaved') : tError(result.error));
  }

  return (
    <View style={styles.container}>
      <TextField
        placeholder={t('lesson.notesPlaceholder')}
        value={notes}
        onChangeText={setNotes}
        multiline
        style={styles.multiline}
        textAlignVertical="top"
      />
      {notes.trim() !== '' && (
        <LabeledField label={t('lesson.notesDone')} inline>
          <Switch value={done} onValueChange={setDone} trackColor={{ true: palette.primary }} accessibilityLabel={t('lesson.notesDone')} />
        </LabeledField>
      )}
      <Button label={t('lesson.saveNotes')} variant="secondary" onPress={save} />
    </View>
  );
}

const useStyles = createStyles(() => ({
  container: { gap: 4 },
  multiline: { minHeight: 80 },
}));
