import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from '../../components/feedback/Toast';
import Button from '../../components/ui/Button';
import DateTimeInput from '../../components/ui/DateTimeInput';
import LabeledField from '../../components/ui/LabeledField';
import TextField from '../../components/ui/TextField';
import { addDaysToKey, todayKey } from '../../domain/dates';
import { createId } from '../../domain/records';
import { useActionFeedback } from '../../hooks/useActionFeedback';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { usePlannerActions } from '../../state/planner';
import { usePreferences } from '../../state/PreferencesProvider';
import { createStyles } from '../../theme/createStyles';
import { useTheme } from '../../theme/ThemeProvider';
import TimeRangeField from '../schedule/components/TimeRangeField';

const STEPS = 3;
const REPEAT_WEEKS = 12;

/** First-launch tour: create a class, add students, plan the first lesson. */
export default function WelcomeScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { palette } = useTheme();
  const { t } = useI18n();
  const actions = usePlannerActions();
  const { setPreference } = usePreferences();
  const toast = useToast();
  const feedback = useActionFeedback(toast.show);

  const [step, setStep] = useState(1);
  const [classId, setClassId] = useState<string | null>(null);
  const [className, setClassName] = useState('');
  const [studentNames, setStudentNames] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState({ startTime: '09:00', endTime: '10:00' });
  const [repeatWeekly, setRepeatWeekly] = useState(true);

  /** Ends the tour; opens the first lesson when one was planned, so attendance is one tap away. */
  function finish(lessonId?: string) {
    setPreference('onboardingDone', true);
    router.replace('/');
    if (lessonId) router.push({ pathname: '/lesson/[id]', params: { id: lessonId } });
  }

  function createClass() {
    const result = actions.addClass({ name: className });
    if (!feedback(result)) return;
    setClassId(result.value.id);
    setStep(2);
  }

  function addStudents() {
    if (!classId) return;
    for (const name of studentNames.split('\n').map((line) => line.trim()).filter(Boolean)) {
      // Duplicates are simply skipped; the tour should never get stuck on them.
      actions.addStudent({ classId, name });
    }
    setStep(3);
  }

  function planLesson() {
    if (!classId) return;
    const lessonId = createId();
    const result = actions.saveLesson({
      draft: { id: lessonId, classId, subject, date, room: '', ...time },
      recurrence: repeatWeekly ? { frequency: 'weekly', until: addDaysToKey(date, REPEAT_WEEKS * 7) } : undefined,
    });
    if (feedback(result)) finish(lessonId);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={palette.scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>ClassPilot</Text>
        <Text style={styles.title} accessibilityRole="header">{t('welcome.title')}</Text>
        <Text style={styles.intro}>{t('welcome.intro')}</Text>
        <View style={styles.progress} accessibilityLabel={t('welcome.step', { current: step, total: STEPS })}>
          {Array.from({ length: STEPS }, (_, index) => <View key={index} style={[styles.dot, index < step && styles.dotActive]} />)}
        </View>
        <Text style={styles.stepLabel}>{t('welcome.step', { current: step, total: STEPS })}</Text>

        <View style={styles.card}>
          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>{t('welcome.classTitle')}</Text>
              <TextField placeholder={t('welcome.classPlaceholder')} value={className} onChangeText={setClassName} onSubmitEditing={createClass} autoFocus />
              <Button label={t('welcome.next')} onPress={createClass} disabled={!className.trim()} />
            </>
          )}
          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>{t('welcome.studentsTitle')}</Text>
              <Text style={styles.hint}>{t('welcome.studentsHint')}</Text>
              <TextField
                placeholder={t('welcome.studentsPlaceholder')}
                value={studentNames}
                onChangeText={setStudentNames}
                multiline
                style={styles.multiline}
                textAlignVertical="top"
                autoFocus
              />
              <Button label={t('welcome.next')} onPress={addStudents} />
            </>
          )}
          {step === 3 && (
            <>
              <Text style={styles.stepTitle}>{t('welcome.lessonTitle')}</Text>
              <TextField placeholder={t('welcome.subjectPlaceholder')} value={subject} onChangeText={setSubject} autoFocus />
              <LabeledField label={t('welcome.day')} inline>
                <DateTimeInput mode="date" value={date} onChange={setDate} accessibilityLabel={t('welcome.day')} />
              </LabeledField>
              <Text style={styles.fieldLabel}>{t('welcome.time')}</Text>
              <TimeRangeField startTime={time.startTime} endTime={time.endTime} onChange={setTime} />
              <LabeledField label={t('welcome.repeatWeekly')} inline>
                <Switch value={repeatWeekly} onValueChange={setRepeatWeekly} trackColor={{ true: palette.primary }} accessibilityLabel={t('welcome.repeatWeekly')} />
              </LabeledField>
              <Button label={t('welcome.finish')} onPress={planLesson} disabled={!subject.trim()} />
            </>
          )}
          {step > 1 && <Button label={t('welcome.back')} variant="text" onPress={() => setStep(step - 1)} />}
        </View>

        <Button label={t('welcome.skip')} variant="text" onPress={() => finish()} />
      </ScrollView>
      <Toast message={toast.message} />
    </SafeAreaView>
  );
}

const useStyles = createStyles((c) => ({
  safeArea: { flex: 1, backgroundColor: c.background },
  content: { padding: 24, paddingBottom: 48, gap: 10, maxWidth: 520, width: '100%', alignSelf: 'center' },
  logo: { color: c.primary, fontWeight: '800', letterSpacing: 1.5, fontSize: 13, textAlign: 'auto' },
  title: { color: c.text, fontSize: 28, fontWeight: '800', textAlign: 'auto' },
  intro: { color: c.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'auto' },
  progress: { flexDirection: 'row', gap: 6, marginTop: 12 },
  dot: { flex: 1, height: 5, borderRadius: 3, backgroundColor: c.segmentTrack },
  dotActive: { backgroundColor: c.primary },
  stepLabel: { color: c.textSubtle, fontSize: 12, fontWeight: '700', textAlign: 'auto' },
  card: { backgroundColor: c.surface, borderRadius: 18, padding: 18, gap: 6, borderWidth: 1, borderColor: c.divider },
  stepTitle: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 6, textAlign: 'auto' },
  hint: { color: c.textMuted, fontSize: 13, marginBottom: 6, textAlign: 'auto' },
  fieldLabel: { color: c.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 7, textAlign: 'auto' },
  multiline: { minHeight: 120 },
}));
