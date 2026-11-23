import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import BarChart from '../../components/ui/BarChart';
import Card from '../../components/ui/Card';
import ListRow from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import { todayKey } from '../../domain/dates';
import { classInsights, RISK_THRESHOLDS, RiskReason } from '../../domain/insights';
import { SavedClass } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { useAssessments, useBehaviorNotes, useLessons, usePlannerSelector, useScoreIndex, useStudents } from '../../state/planner';
import { createStyles } from '../../theme/createStyles';
import { useSharedStyles } from '../../theme/sharedStyles';
import MissingClass from '../classes/MissingClass';
import { useRouteClass } from '../classes/useRouteClass';

export default function InsightsScreen() {
  const { savedClass } = useRouteClass();
  return savedClass ? <Insights savedClass={savedClass} /> : <MissingClass />;
}

function Insights({ savedClass }: { savedClass: SavedClass }) {
  const styles = useStyles();
  const shared = useSharedStyles();
  const router = useRouter();
  const { t, formatDate } = useI18n();
  const students = useStudents(savedClass.id);
  const lessons = useLessons();
  const assessments = useAssessments(savedClass.id);
  const scores = useScoreIndex();
  const attendance = usePlannerSelector((state) => state.attendance);
  const homework = usePlannerSelector((state) => state.homework);
  const behavior = useBehaviorNotes();

  const insights = useMemo(() => classInsights({
    students,
    lessons: lessons.filter((lesson) => lesson.classId === savedClass.id),
    attendance,
    assessments,
    scores,
    homework,
    behavior,
    today: todayKey(),
  }), [students, lessons, savedClass.id, attendance, assessments, scores, homework, behavior]);

  const describe = (reason: RiskReason) => {
    switch (reason.kind) {
      case 'attendance': return t('insights.reasonAttendance', { rate: reason.rate });
      case 'grades': return t('insights.reasonGrades', { average: reason.average });
      case 'homework': return t('insights.reasonHomework', { missing: reason.missing });
      case 'behavior': return t('insights.reasonBehavior', { negative: reason.negative });
    }
  };

  const stats = [
    { label: t('insights.attendance'), value: insights.attendanceRate },
    { label: t('insights.homework'), value: insights.homeworkRate },
    { label: t('insights.grades'), value: insights.averageGrade },
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: `${t('insights.title')} · ${savedClass.name}` }} />

      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat} accessible accessibilityLabel={`${stat.label}: ${stat.value === null ? t('insights.noData') : `${stat.value}%`}`}>
            <Text style={styles.statValue}>{stat.value === null ? '–' : `${stat.value}%`}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <Card title={t('insights.attendanceTrend')}>
        <BarChart
          accessibilityLabel={t('insights.attendanceTrend')}
          warnBelow={RISK_THRESHOLDS.attendanceRate}
          bars={insights.attendanceTrend.map((week) => ({ key: week.weekStart, label: formatDate(week.weekStart, 'shortDate'), value: week.rate }))}
        />
      </Card>

      <Card title={t('insights.gradeTrend')}>
        {insights.gradeTrend.length ? (
          <BarChart
            accessibilityLabel={t('insights.gradeTrend')}
            warnBelow={RISK_THRESHOLDS.averageGrade}
            bars={insights.gradeTrend.map((point) => ({ key: point.assessment.id, label: point.assessment.title, value: point.average }))}
          />
        ) : <Text style={shared.hint}>{t('insights.noData')}</Text>}
      </Card>

      <Card flush title={t('insights.atRisk')}>
        {insights.atRisk.map(({ student, reasons }) => (
          <ListRow
            key={student.id}
            divider
            title={student.name}
            subtitle={reasons.map(describe).join(' · ')}
            onPress={() => router.push({ pathname: '/class/[id]/student/[studentId]', params: { id: savedClass.id, studentId: student.id } })}
          />
        ))}
        {insights.atRisk.length === 0 && <Text style={[shared.hint, styles.padded]}>{t('insights.noRisk')}</Text>}
      </Card>
    </Screen>
  );
}

const useStyles = createStyles((c) => ({
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: c.surface, borderRadius: 13, padding: 12, borderWidth: 1, borderColor: c.divider },
  statValue: { color: c.text, fontSize: 22, fontWeight: '800', textAlign: 'auto' },
  statLabel: { color: c.textSubtle, fontSize: 11, marginTop: 3, textAlign: 'auto' },
  padded: { paddingHorizontal: 16, paddingBottom: 16 },
}));
