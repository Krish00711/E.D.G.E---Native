import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import { Colors, Spacing, Radius, FontSize, FontWeight, riskColor } from '../../../constants/theme'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { RadarMini, RiskDonut, Sparkline } from '../../../components/EdgeCharts'

interface Prediction {
  riskLevel: string
  riskScore: number
  confidence: number
  exhaustionScore?: number
  cynicismScore?: number
  efficacyScore?: number
  dimensionScores?: {
    exhaustion?: number
    cynicism?: number
    efficacy?: number
  }
  createdAt: string
}

interface DashboardData {
  prediction: Prediction | null
  streak: number
  lastCheckin: string | null
}

interface ForecastPoint {
  day?: number
  projected_risk_score?: number
  risk_score?: number
}

export default function DashboardScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [data, setData] = useState<DashboardData>({ prediction: null, streak: 0, lastCheckin: null })
  const [forecast, setForecast] = useState<ForecastPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const studentId = user?.studentId
      if (!studentId) return

      const [predRes, selfRes, fcRes] = await Promise.allSettled([
        api.get(`/predictions/latest/${studentId}`),
        api.get('/self-reports', { params: { limit: 1 } }),
        api.get(`/predictions/forecast/${studentId}`),
      ])

      const prediction = predRes.status === 'fulfilled' ? predRes.value.data : null
      const reports = selfRes.status === 'fulfilled' ? selfRes.value.data : []
      const lastCheckin = Array.isArray(reports) && reports.length > 0
        ? reports[0].createdAt : null

      const forecastPayload = fcRes.status === 'fulfilled' ? fcRes.value.data : null
      const points = forecastPayload?.forecast || forecastPayload?.projections || []

      setData({ prediction, streak: 0, lastCheckin })
      setForecast(Array.isArray(points) ? points : [])
    } catch {
      // silently fail — show empty state
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.studentId])

  useEffect(() => { load() }, [load])

  function onRefresh() {
    setRefreshing(true)
    load()
  }

  async function recalculate() {
    try {
      setLoading(true)
      const studentId = user?.studentId
      if (!studentId) return
      const res = await api.post(`/predictions/calculate/${studentId}`)
      setData((prev) => ({ ...prev, prediction: res.data.prediction }))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const risk = data.prediction?.riskLevel
  const riskScore = data.prediction?.riskScore ?? 0
  const color = riskColor(risk)
  const exhaustion = data.prediction?.exhaustionScore ?? data.prediction?.dimensionScores?.exhaustion ?? 0
  const cynicism = data.prediction?.cynicismScore ?? data.prediction?.dimensionScores?.cynicism ?? 0
  const efficacy = data.prediction?.efficacyScore ?? data.prediction?.dimensionScores?.efficacy ?? 0
  const sparkPoints = forecast.length > 0
    ? forecast.map((f) => f.projected_risk_score ?? f.risk_score ?? 0)
    : [Math.max(0, riskScore - 0.08), riskScore, Math.min(1, riskScore + 0.06)]

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>E.D.G.E.</Text>
            <Text style={styles.greeting}>Hello {user?.name?.split(' ')[0]},</Text>
            <Text style={styles.date}>{new Date().toDateString()}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconChip} onPress={() => router.push('/(app)/(student)/notifications')}>
              <Ionicons name="notifications-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.statusChip, { borderColor: color + '55' }]}>
              <Text style={[styles.statusChipText, { color }]}>{risk ? risk.toUpperCase() : 'N/A'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.riskCard}>
          {loading ? (
            <ActivityIndicator color={Colors.teal} />
          ) : data.prediction ? (
            <>
              <View style={styles.riskTop}>
                <View>
                  <Text style={styles.riskLabel}>Burnout Risk</Text>
                  <Text style={[styles.riskLevel, { color }]}>{risk?.toUpperCase()}</Text>
                </View>
                <RiskDonut score={riskScore} strokeColor={color} />
              </View>

              <View style={styles.sparkWrap}>
                <View style={styles.sparkHead}>
                  <Text style={styles.sparkTitle}>7-day micro trend</Text>
                  <Text style={styles.sparkValue}>{Math.round(riskScore * 100)}%</Text>
                </View>
                <Sparkline points={sparkPoints} color={color} width={260} height={50} />
              </View>

              <View style={styles.dimensionsCard}>
                <RadarMini exhaustion={exhaustion} cynicism={cynicism} efficacy={efficacy} />
                <View style={styles.dimensions}>
                {[
                  { label: 'Exhaustion', value: exhaustion, color: Colors.exhaustion },
                  { label: 'Cynicism', value: cynicism, color: Colors.cynicism },
                  { label: 'Efficacy', value: efficacy, color: Colors.efficacy },
                ].map((d) => (
                  <View key={d.label} style={styles.dimRow}>
                    <Text style={styles.dimLabel}>{d.label}</Text>
                    <View style={styles.dimBarBg}>
                      <View style={[styles.dimBar, { width: `${Math.round(d.value * 100)}%`, backgroundColor: d.color }]} />
                    </View>
                    <Text style={[styles.dimValue, { color: d.color }]}>{Math.round(d.value * 100)}%</Text>
                  </View>
                ))}
                </View>
              </View>

              <TouchableOpacity style={styles.explainBtn} onPress={() => router.push('/(app)/(student)/burnout')}>
                <Text style={styles.explainBtnText}>View full analysis →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emptyRisk}>
              <Text style={styles.emptyText}>No prediction yet</Text>
              <TouchableOpacity style={styles.calcBtn} onPress={recalculate}>
                <Text style={styles.calcBtnText}>Calculate Now</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Quick Actions →</Text>
        <View style={styles.actions}>
          {[
            { label: 'Check-in', icon: 'pulse', route: '/(app)/(student)/checkin' },
            { label: 'What-If', icon: 'flask', route: '/(app)/(student)/whatif' },
            { label: 'Recovery', icon: 'heart', route: '/(app)/(student)/recovery' },
            { label: 'Peer Pulse', icon: 'people', route: '/(app)/(student)/peerpulse' },
            { label: 'Anomaly', icon: 'warning', route: '/(app)/(student)/anomaly' },
            { label: 'Forecast', icon: 'trending-up', route: '/(app)/(student)/burnout' },
          ].map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.actionCard}
              onPress={() => router.push(a.route as any)}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name={a.icon as any} size={18} color={Colors.teal} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {data.lastCheckin && (
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.infoText}>
              Last check-in: {new Date(data.lastCheckin).toLocaleDateString()}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.recalcBtn} onPress={recalculate} disabled={loading}>
          <Ionicons name="refresh" size={16} color={Colors.teal} />
          <Text style={styles.recalcText}>Recalculate Risk</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: Spacing.lg, paddingTop: 50, paddingBottom: 42 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  headerActions: { alignItems: 'flex-end', gap: Spacing.xs },
  iconChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111CC',
  },
  statusChip: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#0F0F0FBB',
  },
  statusChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, letterSpacing: 0.6 },
  brand: { fontSize: FontSize.md, color: Colors.teal, fontWeight: FontWeight.bold, fontFamily: 'Georgia', marginBottom: 6 },
  greeting: { fontSize: 28, fontWeight: FontWeight.bold, color: Colors.textPrimary, fontFamily: 'Georgia' },
  date: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2, fontFamily: 'Georgia' },
  riskCard: {
    backgroundColor: '#2B2A2ED9',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#9D1B1B',
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  riskTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  riskLabel: { fontSize: 19, color: Colors.textPrimary, fontFamily: 'Georgia' },
  riskLevel: { fontSize: 42, fontWeight: FontWeight.bold, fontFamily: 'Georgia' },
  sparkWrap: {
    backgroundColor: '#171717D1',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#8C6A1D66',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sparkHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sparkTitle: { color: Colors.textSecondary, fontSize: FontSize.xs },
  sparkValue: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  dimensionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  dimensions: { flex: 1, gap: Spacing.sm },
  dimRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dimLabel: { width: 74, fontSize: 13, color: Colors.textPrimary },
  dimBarBg: { flex: 1, height: 8, borderRadius: 6, backgroundColor: '#6F5A222B', overflow: 'hidden' },
  dimBar: { height: '100%', borderRadius: 6 },
  dimValue: { width: 36, fontSize: 12, textAlign: 'right', fontFamily: 'Georgia' },
  explainBtn: { alignSelf: 'flex-end' },
  explainBtnText: { color: Colors.teal, fontSize: FontSize.md, fontFamily: 'Georgia' },
  emptyRisk: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  emptyText: { color: Colors.textSecondary, fontSize: FontSize.md },
  calcBtn: { backgroundColor: Colors.teal, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  calcBtnText: { color: '#1A1404', fontWeight: FontWeight.bold },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: Spacing.md, fontFamily: 'Georgia' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  actionCard: {
    width: '30%',
    backgroundColor: '#141414E6',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#8C6A1D4D',
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#3023066B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: FontSize.xs, color: Colors.textPrimary, textAlign: 'center', fontWeight: FontWeight.medium },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  infoText: { fontSize: FontSize.xs, color: Colors.textMuted },
  recalcBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, padding: Spacing.md,
    borderWidth: 1, borderColor: '#8C6A1D', borderRadius: Radius.md,
    backgroundColor: '#121212C8',
  },
  recalcText: { color: Colors.teal, fontSize: FontSize.sm, fontFamily: 'Georgia' },
})
