import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { RiskDonut } from '../../../components/EdgeCharts'
import { Colors, Spacing, Radius, FontSize, FontWeight, riskColor } from '../../../constants/theme'

interface ComparisonItem {
  label: string
  yourValue: number
  cohortAvg: number
  unit: string
  higherIsBetter: boolean
}

export default function PeerPulseScreen() {
  const { user } = useAuthStore()
  const [data, setData] = useState<ComparisonItem[]>([])
  const [cohortRisk, setCohortRisk] = useState<any>(null)
  const [myRisk, setMyRisk] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const studentId = user?.studentId
      if (!studentId) return

      const [myPredRes, myFeatRes] = await Promise.allSettled([
        api.get(`/predictions/latest/${studentId}`),
        api.get(`/features/${studentId}`),
      ])

      const myPred = myPredRes.status === 'fulfilled' ? myPredRes.value.data : null
      const myFeat = myFeatRes.status === 'fulfilled' ? myFeatRes.value.data : null

      // Try to get cohort aggregate data; fall back to null gracefully
      let cohort: any = null
      try {
        const cohortRes = await api.get('/admin/cohorts')
        const cohorts = cohortRes.data?.cohorts ?? []
        if (cohorts.length > 0) {
          // Use first cohort as reference averages
          cohort = {
            avg_sleep_hours: 7,
            avg_activity_frequency: 5,
            avg_attendance_rate: 80,
            avg_stress_score: 5,
            avg_gpa: 3.0,
            avg_screen_time: 4,
            avg_risk_score: cohorts[0]?.avgRisk,
            avg_risk_level: cohorts[0]?.avgRisk > 0.6 ? 'high' : cohorts[0]?.avgRisk > 0.3 ? 'moderate' : 'low',
          }
        }
      } catch {
        // cohort data unavailable — use estimated averages
        cohort = {
          avg_sleep_hours: 7,
          avg_activity_frequency: 5,
          avg_attendance_rate: 80,
          avg_stress_score: 5,
          avg_gpa: 3.0,
          avg_screen_time: 4,
        }
      }

      setMyRisk(myPred)
      setCohortRisk(cohort)

      if (myFeat && cohort) {
        const items: ComparisonItem[] = [
          { label: 'Sleep Hours', yourValue: myFeat.sleep_hours || 0, cohortAvg: cohort.avg_sleep_hours || 7, unit: 'hrs', higherIsBetter: true },
          { label: 'Study Sessions/wk', yourValue: myFeat.activity_frequency || 0, cohortAvg: cohort.avg_activity_frequency || 5, unit: '', higherIsBetter: true },
          { label: 'Attendance', yourValue: myFeat.attendance_rate || 0, cohortAvg: cohort.avg_attendance_rate || 80, unit: '%', higherIsBetter: true },
          { label: 'Stress Level', yourValue: myFeat.stress_score || 0, cohortAvg: cohort.avg_stress_score || 5, unit: '/10', higherIsBetter: false },
          { label: 'GPA', yourValue: myFeat.gpa || 0, cohortAvg: cohort.avg_gpa || 3.0, unit: '', higherIsBetter: true },
          { label: 'Screen Time', yourValue: myFeat.screen_time_hours || 0, cohortAvg: cohort.avg_screen_time || 4, unit: 'hrs', higherIsBetter: false },
        ]
        setData(items)
      }
    } catch {}
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.studentId])

  useEffect(() => { load() }, [load])

  function getPercentile(yours: number, avg: number, higherIsBetter: boolean): { pct: number; label: string; color: string } {
    const diff = ((yours - avg) / (avg || 1)) * 100
    if (higherIsBetter) {
      if (diff > 10) return { pct: 75, label: 'Above average', color: Colors.success }
      if (diff < -10) return { pct: 25, label: 'Below average', color: Colors.error }
      return { pct: 50, label: 'On par', color: Colors.textSecondary }
    } else {
      if (diff > 10) return { pct: 25, label: 'Higher than peers', color: Colors.error }
      if (diff < -10) return { pct: 75, label: 'Lower than peers', color: Colors.success }
      return { pct: 50, label: 'On par', color: Colors.textSecondary }
    }
  }

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>Peer Pulse</Text>
        <Text style={styles.subtitle}>Anonymous cohort comparison</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={Colors.teal} />}
        >
          {/* Risk comparison */}
          {myRisk && (
            <View style={styles.riskCompare}>
              <RiskDonut value={myRisk.riskScore || 0} size={68} color={riskColor(myRisk.riskLevel)} trackColor={Colors.border + '66'} />
              <View style={styles.riskBox}>
                <Text style={styles.riskBoxLabel}>Your Risk</Text>
                <Text style={[styles.riskBoxValue, { color: riskColor(myRisk.riskLevel) }]}>
                  {myRisk.riskLevel?.toUpperCase()}
                </Text>
                <Text style={styles.riskBoxScore}>{Math.round((myRisk.riskScore || 0) * 100)}%</Text>
              </View>
              <Ionicons name="swap-horizontal" size={20} color={Colors.textMuted} />
              <View style={styles.riskBox}>
                <Text style={styles.riskBoxLabel}>Cohort Avg</Text>
                <Text style={[styles.riskBoxValue, { color: Colors.textSecondary }]}>
                  {cohortRisk?.avg_risk_level?.toUpperCase() || '—'}
                </Text>
                <Text style={styles.riskBoxScore}>
                  {cohortRisk?.avg_risk_score ? Math.round(cohortRisk.avg_risk_score * 100) + '%' : '—'}
                </Text>
              </View>
            </View>
          )}

          {/* Feature comparisons */}
          {data.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Not enough cohort data yet</Text>
              <Text style={styles.emptySubtext}>Peer Pulse activates once your cohort has more activity</Text>
            </View>
          ) : (
            data.map((item, i) => {
              const { label: statusLabel, color } = getPercentile(item.yourValue, item.cohortAvg, item.higherIsBetter)
              const diff = item.yourValue - item.cohortAvg
              const diffPct = Math.round(Math.abs(diff / (item.cohortAvg || 1)) * 100)
              return (
                <View key={i} style={styles.compareCard}>
                  <View style={styles.compareHeader}>
                    <Text style={styles.compareLabel}>{item.label}</Text>
                    <Text style={[styles.compareStatus, { color }]}>{statusLabel}</Text>
                  </View>
                  <View style={styles.compareRow}>
                    <View style={styles.compareCol}>
                      <Text style={styles.compareColLabel}>You</Text>
                      <Text style={styles.compareColValue}>{item.yourValue.toFixed(1)}{item.unit}</Text>
                    </View>
                    <View style={styles.compareDivider} />
                    <View style={styles.compareCol}>
                      <Text style={styles.compareColLabel}>Cohort avg</Text>
                      <Text style={styles.compareColValue}>{item.cohortAvg.toFixed(1)}{item.unit}</Text>
                    </View>
                  </View>
                  <Text style={[styles.compareDiff, { color }]}>
                    {diff > 0 ? '+' : ''}{diffPct}% {diff > 0 ? 'more' : 'less'} than peers
                  </Text>
                </View>
              )
            })
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, paddingTop: 56 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  content: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.md },
  riskCompare: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: '#121212E6', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg,
  },
  riskBox: { alignItems: 'center', gap: 4 },
  riskBoxLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  riskBoxValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  riskBoxScore: { fontSize: FontSize.sm, color: Colors.textSecondary },
  compareCard: {
    backgroundColor: '#131313E2', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  compareHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compareLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  compareStatus: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  compareRow: { flexDirection: 'row', alignItems: 'center' },
  compareCol: { flex: 1, alignItems: 'center' },
  compareColLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  compareColValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  compareDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  compareDiff: { fontSize: FontSize.xs, textAlign: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.lg, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
})
