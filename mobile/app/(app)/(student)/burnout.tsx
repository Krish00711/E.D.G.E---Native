import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import { mlApi } from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import { Colors, Spacing, Radius, FontSize, FontWeight, riskColor } from '../../../constants/theme'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { RadarMini, RiskDonut, Sparkline } from '../../../components/EdgeCharts'

export default function BurnoutScreen() {
  const { user } = useAuthStore()
  const [prediction, setPrediction] = useState<any>(null)
  const [explanation, setExplanation] = useState<any>(null)
  const [forecast, setForecast] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadingExplain, setLoadingExplain] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'overview' | 'explain' | 'forecast'>('overview')

  const load = useCallback(async () => {
    try {
      const studentId = user?.studentId
      if (!studentId) return

      const predRes = await api.get(`/predictions/latest/${studentId}`)
      setPrediction(predRes.data)

      const forecastRes = await api.get(`/predictions/forecast/${studentId}`).catch(() => null)
      setForecast(forecastRes?.data ?? null)
    } catch {}
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.studentId])

  useEffect(() => { load() }, [load])

  async function loadExplanation() {
    if (explanation || !prediction?.featuresSnapshot) return
    setLoadingExplain(true)
    try {
      const res = await mlApi.post('/explain', prediction.featuresSnapshot)
      setExplanation(res.data)
    } catch {}
    finally { setLoadingExplain(false) }
  }

  useEffect(() => {
    if (tab === 'explain') loadExplanation()
  }, [tab])

  const color = riskColor(prediction?.riskLevel)

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>Burnout Analysis</Text>
      </View>

      <View style={styles.tabs}>
        {(['overview', 'explain', 'forecast'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={Colors.teal} />}
        >
          {tab === 'overview' && prediction && (
            <View style={styles.section}>
              {/* Risk summary */}
              <View style={[styles.riskCard, { borderColor: color }]}>
                <View style={styles.riskTop}>
                  <View>
                    <Text style={styles.riskLabel}>Current Risk Level</Text>
                    <Text style={[styles.riskLevel, { color }]}>{prediction.riskLevel?.toUpperCase()}</Text>
                    <Text style={styles.riskScore}>Score: {Math.round((prediction.riskScore || 0) * 100)}%</Text>
                    <Text style={styles.riskConfidence}>Confidence: {Math.round((prediction.confidence || 0) * 100)}%</Text>
                  </View>
                  <RiskDonut score={prediction.riskScore || 0} strokeColor={color} />
                </View>

                <View style={styles.sparkCard}>
                  <Text style={styles.sparkTitle}>7-day risk microtrend</Text>
                  <Sparkline
                    points={
                      (forecast?.forecast || forecast?.projections || [])
                        .map((f: any) => f.projected_risk_score ?? f.risk_score ?? 0)
                    }
                    color={color}
                    width={280}
                    height={52}
                  />
                </View>
              </View>

              {/* 3 Dimension scores */}
              <Text style={styles.sectionTitle}>Burnout Dimensions</Text>
              <View style={styles.dimCard}>
                <View style={styles.radarWrap}>
                  <RadarMini
                    exhaustion={prediction.exhaustionScore ?? prediction.dimensionScores?.exhaustion ?? 0}
                    cynicism={prediction.cynicismScore ?? prediction.dimensionScores?.cynicism ?? 0}
                    efficacy={prediction.efficacyScore ?? prediction.dimensionScores?.efficacy ?? 0}
                  />
                </View>
                <View style={styles.dimList}>
                  {[
                    { label: 'Exhaustion', value: prediction.exhaustionScore ?? prediction.dimensionScores?.exhaustion, color: Colors.exhaustion, desc: 'Physical & emotional depletion' },
                    { label: 'Cynicism', value: prediction.cynicismScore ?? prediction.dimensionScores?.cynicism, color: Colors.cynicism, desc: 'Detachment & disengagement' },
                    { label: 'Efficacy', value: prediction.efficacyScore ?? prediction.dimensionScores?.efficacy, color: Colors.efficacy, desc: 'Sense of accomplishment' },
                  ].map((d) => (
                    <View key={d.label} style={styles.dimRowWrap}>
                      <View style={styles.dimHeader}>
                        <View>
                          <Text style={styles.dimLabel}>{d.label}</Text>
                          <Text style={styles.dimDesc}>{d.desc}</Text>
                        </View>
                        <Text style={[styles.dimScore, { color: d.color }]}>
                          {Math.round((d.value || 0) * 100)}%
                        </Text>
                      </View>
                      <View style={styles.dimBarBg}>
                        <View style={[styles.dimBar, { width: `${Math.round((d.value || 0) * 100)}%`, backgroundColor: d.color }]} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              <Text style={styles.timestamp}>
                Last updated: {prediction.createdAt ? new Date(prediction.createdAt).toLocaleString() : '—'}
              </Text>
            </View>
          )}

          {tab === 'explain' && (
            <View style={styles.section}>
              {loadingExplain ? (
                <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
              ) : explanation ? (
                <>
                  <Text style={styles.sectionTitle}>Why is your risk {prediction?.riskLevel}?</Text>
                  {explanation.top_reasons?.map((reason: string, i: number) => (
                    <View key={i} style={styles.reasonCard}>
                      <Ionicons name="information-circle" size={16} color={Colors.teal} />
                      <Text style={styles.reasonText}>{reason}</Text>
                    </View>
                  ))}

                  <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Feature Impact</Text>
                  {explanation.contributions?.slice(0, 8).map((c: any, i: number) => (
                    <View key={i} style={styles.featureRow}>
                      <Text style={styles.featureName}>{c.feature.replace(/_/g, ' ')}</Text>
                      <View style={styles.featureBarBg}>
                        <View style={[
                          styles.featureBar,
                          {
                            width: `${Math.min(100, Math.abs(c.shap_value) * 200)}%`,
                            backgroundColor: c.impact === 'increases_risk' ? Colors.error : Colors.success,
                          }
                        ]} />
                      </View>
                      <Text style={[styles.featureImpact, { color: c.impact === 'increases_risk' ? Colors.error : Colors.success }]}>
                        {c.impact === 'increases_risk' ? '↑' : '↓'}
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No explanation available</Text>
                  <Text style={styles.emptySubtext}>Complete a check-in first to generate your risk profile</Text>
                </View>
              )}
            </View>
          )}

          {tab === 'forecast' && (
            <View style={styles.section}>
              {forecast ? (
                <>
                  <View style={[styles.trendCard, {
                    borderColor: forecast.trend === 'worsening' ? Colors.error
                      : forecast.trend === 'improving' ? Colors.success : Colors.border
                  }]}>
                    <Text style={styles.trendLabel}>7-Day Trend</Text>
                    <Text style={[styles.trendValue, {
                      color: forecast.trend === 'worsening' ? Colors.error
                        : forecast.trend === 'improving' ? Colors.success : Colors.textSecondary
                    }]}>
                      {forecast.trend?.toUpperCase()}
                    </Text>
                    <Text style={styles.trendMessage}>{forecast.message}</Text>
                    {(forecast.days_until_high_risk ?? forecast.daysUntilHighRisk) && (
                      <View style={styles.warningBanner}>
                        <Ionicons name="warning" size={16} color={Colors.amber} />
                        <Text style={styles.warningText}>
                          High risk in ~{forecast.days_until_high_risk ?? forecast.daysUntilHighRisk} days
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.sectionTitle}>Projected Risk</Text>
                  {(forecast.forecast || forecast.projections)?.map((f: any, i: number) => (
                    <View key={i} style={styles.forecastRow}>
                      <Text style={styles.forecastDay}>Day {f.day ?? i + 1}</Text>
                      <View style={styles.forecastBarBg}>
                        <View style={[
                          styles.forecastBar,
                          {
                            width: `${Math.round((f.projected_risk_score ?? f.risk_score ?? 0) * 100)}%`,
                            backgroundColor: riskColor(f.projected_risk_level ?? (f.risk_score > 0.6 ? 'high' : f.risk_score > 0.3 ? 'moderate' : 'low')),
                          }
                        ]} />
                      </View>
                      <Text style={[styles.forecastScore, { color: riskColor(f.projected_risk_level ?? (f.risk_score > 0.6 ? 'high' : f.risk_score > 0.3 ? 'moderate' : 'low')) }]}>
                        {Math.round((f.projected_risk_score ?? f.risk_score ?? 0) * 100)}%
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Keep logging check-ins to unlock your 7-day forecast</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, paddingTop: 56 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, fontFamily: 'Georgia' },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  tab: { flex: 1, padding: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: '#111111CC' },
  tabActive: { borderColor: Colors.teal, backgroundColor: Colors.teal + '1F' },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  tabTextActive: { color: Colors.teal, fontWeight: FontWeight.semibold },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  section: { gap: Spacing.md },
  riskCard: {
    backgroundColor: '#2B2A2ED9', borderRadius: Radius.lg,
    borderWidth: 1, padding: Spacing.lg, alignItems: 'center', gap: 4,
  },
  riskTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  riskLevel: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, fontFamily: 'Georgia' },
  riskScore: { fontSize: FontSize.lg, color: Colors.textPrimary },
  riskConfidence: { fontSize: FontSize.sm, color: Colors.textMuted },
  sparkCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#8C6A1D66',
    borderRadius: Radius.md,
    backgroundColor: '#171717D1',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  sparkTitle: { color: Colors.textSecondary, fontSize: FontSize.xs },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  dimCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  radarWrap: { marginRight: Spacing.sm },
  dimList: { flex: 1, gap: Spacing.sm },
  dimRowWrap: { gap: Spacing.xs },
  dimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dimLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  dimDesc: { fontSize: FontSize.xs, color: Colors.textMuted },
  dimScore: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  dimBarBg: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  dimBar: { height: '100%', borderRadius: 4 },
  timestamp: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  reasonCard: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  reasonText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  featureName: { width: 120, fontSize: FontSize.xs, color: Colors.textSecondary },
  featureBarBg: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  featureBar: { height: '100%', borderRadius: 3 },
  featureImpact: { width: 16, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  trendCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, padding: Spacing.lg, gap: Spacing.sm,
  },
  trendLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  trendValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  trendMessage: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  warningBanner: {
    flexDirection: 'row', gap: Spacing.xs, alignItems: 'center',
    backgroundColor: Colors.amber + '22', borderRadius: Radius.sm, padding: Spacing.sm,
  },
  warningText: { color: Colors.amber, fontSize: FontSize.sm },
  forecastRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  forecastDay: { width: 44, fontSize: FontSize.xs, color: Colors.textSecondary },
  forecastBarBg: { flex: 1, height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  forecastBar: { height: '100%', borderRadius: 4 },
  forecastScore: { width: 36, fontSize: FontSize.xs, textAlign: 'right', fontWeight: FontWeight.semibold },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.lg, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
})
