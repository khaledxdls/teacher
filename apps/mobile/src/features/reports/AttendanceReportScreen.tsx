import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import DateTimeInput from '../../components/ui/DateTimeInput';
import LabeledField from '../../components/ui/LabeledField';
import Screen from '../../components/ui/Screen';
import SegmentedControl from '../../components/ui/SegmentedControl';
import { addDays, dateKey } from '../../domain/dates';
import { buildAttendanceReport, DateRange, ReportLabels, toCsv, toHtml } from '../../domain/reports';
import { SavedClass } from '../../domain/types';
import { useToast } from '../../hooks/useToast';
import { useI18n } from '../../i18n/I18nProvider';
import { reportError } from '../../services/errorReporting';
import { FILE_KINDS, sharePdf, shareTextFile, SharingUnavailableError } from '../../services/export';
import { useCalendar, useLessons, usePlannerSelector, useStudents } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';
import { useSharedStyles } from '../../theme/sharedStyles';
import MissingClass from '../classes/MissingClass';
import { useRouteClass } from '../classes/useRouteClass';
import { availablePresets, RangePreset, rangeForPreset } from './reportRange';

export default function AttendanceReportScreen() {
  const { savedClass } = useRouteClass();
  return savedClass ? <Report savedClass={savedClass} /> : <MissingClass />;
}

function Report({ savedClass }: { savedClass: SavedClass }) {
  const styles = useStyles();
  const shared = useSharedStyles();
  const { t, formatDate, isRTL } = useI18n();
  const lessons = useLessons();
  const students = useStudents(savedClass.id);
  const marks = usePlannerSelector((state) => state.attendance);
  const calendar = useCalendar();
  const toast = useToast();
  const today = useMemo(() => new Date(), []);

  const [preset, setPreset] = useState<RangePreset>('thisMonth');
  const [custom, setCustom] = useState<DateRange>({ from: dateKey(addDays(today, -29)), to: dateKey(today) });
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);

  const classLessons = useMemo(() => lessons.filter((lesson) => lesson.classId === savedClass.id), [lessons, savedClass.id]);
  const range = useMemo(
    () => rangeForPreset(preset, today, calendar.events, classLessons, custom),
    [preset, today, calendar.events, classLessons, custom],
  );
  const report = useMemo(() => buildAttendanceReport(savedClass, students, classLessons, marks, range), [savedClass, students, classLessons, marks, range]);
  const rangeLabel = t('report.range', { from: formatDate(range.from, 'dayMonthYear'), to: formatDate(range.to, 'dayMonthYear') });

  const labels: ReportLabels = {
    title: t('report.heading', { className: savedClass.name }),
    student: t('report.student'),
    present: t('attendance.present'),
    late: t('attendance.late'),
    absent: t('attendance.absent'),
    rate: t('report.rate'),
    status: { present: t('report.statusShort.present'), late: t('report.statusShort.late'), absent: t('report.statusShort.absent') },
    lessonHeader: (lesson) => `${formatDate(lesson.date, 'weekdayDay')} ${lesson.startTime}`,
    rangeLabel,
  };

  async function share(kind: 'csv' | 'pdf') {
    setBusy(kind);
    try {
      if (kind === 'csv') await shareTextFile(`${savedClass.name}-attendance-${range.from}-${range.to}`, toCsv(report, labels), FILE_KINDS.csv, labels.title);
      else await sharePdf(toHtml(report, labels, isRTL ? 'rtl' : 'ltr'), labels.title);
    } catch (error) {
      if (error instanceof SharingUnavailableError) toast.show(t('report.shareUnavailable'));
      else {
        reportError(error, { where: `export:${kind}` });
        toast.show(t('report.exportFailed'));
      }
    } finally {
      setBusy(null);
    }
  }

  const presets = availablePresets(calendar.events, today);
  const canExport = report.lessons.length > 0 && report.rows.length > 0;

  return (
    <Screen toastMessage={toast.message}>
      <Stack.Screen options={{ title: t('report.title') }} />

      <Card title={t('report.period')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <SegmentedControl options={presets.map((value) => ({ value, label: t(`report.${value}`) }))} value={preset} onChange={setPreset} />
        </ScrollView>
        {preset === 'custom' ? (
          <View style={styles.customRange}>
            <LabeledField label={t('report.from')}>
              <DateTimeInput mode="date" value={custom.from} onChange={(from) => setCustom((current) => ({ ...current, from }))} accessibilityLabel={t('report.from')} />
            </LabeledField>
            <LabeledField label={t('report.to')}>
              <DateTimeInput mode="date" value={custom.to} minimumDate={custom.from} onChange={(to) => setCustom((current) => ({ ...current, to }))} accessibilityLabel={t('report.to')} />
            </LabeledField>
          </View>
        ) : (
          <Text style={shared.hint}>{rangeLabel}</Text>
        )}
        <Text style={shared.subtitle}>{t('report.lessons', { count: report.lessons.length })}</Text>
      </Card>

      {report.rows.length === 0 ? (
        <Text style={shared.emptyText}>{t('report.noStudents')}</Text>
      ) : (
        <Card flush>
          {report.rows.map((row, index) => (
            <View key={row.student.id} style={[styles.row, index > 0 && styles.divider]}>
              <Text style={styles.name}>{row.student.name}</Text>
              <Text style={styles.totals}>{t('attendance.totals', row.stats)}</Text>
              <Text style={styles.rate}>{row.rate === null ? '–' : `${row.rate}%`}</Text>
            </View>
          ))}
        </Card>
      )}

      <Button label={t('report.shareCsv')} onPress={() => void share('csv')} loading={busy === 'csv'} disabled={!canExport || busy !== null} />
      <Button label={t('report.sharePdf')} variant="secondary" onPress={() => void share('pdf')} loading={busy === 'pdf'} disabled={!canExport || busy !== null} />
    </Screen>
  );
}

const useStyles = createStyles((c) => ({
  customRange: { flexDirection: 'row', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  divider: { borderTopWidth: 1, borderTopColor: c.divider },
  name: { color: c.text, fontWeight: '600', flex: 1, textAlign: 'auto' },
  totals: { color: c.textSubtle, fontSize: 11, flex: 2, textAlign: 'auto' },
  rate: { color: c.text, fontWeight: '800', width: 48, textAlign: 'right' },
}));
