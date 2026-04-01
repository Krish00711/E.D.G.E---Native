import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

interface Report {
  _id: string
  type: string
  title?: string
  status: string
  createdAt: string
  data?: Record<string, any>
}

interface CohortInsight {
  cohortId?: string
  avgRiskScore?: number
  highRiskCount?: number
  totalStudents?: number
}

export default function ReportsScreen() {
  const [reports, setReports] = useState<Report[]>([])
  const [insights, setInsights] = useState<CohortInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'reports' | 'insights'>('reports')

  const load = useCallback(async () => {
    try {
      const [rRes, iRes] = await Promise.allSettled([
        api.get('/reports', { params: { limit: 20 } }),
        api.get('/insights', { params: { limit: 10 } }),
      ])

      if (rRes.status === 'fulfilled') {
        const d = rRes.value.data
        setReports(Array.isArray(d) ? d : d?.reports ?? [])
      }
      if (iRes.status === 'fulfilled') {
        const d = iRes.value.data
        setInsights(Array.isArray(d) ? d : d?.insights ?? [])
      }
    } catch {
      // show empty state
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function onRefresh() { setRefreshing(true); load() }

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>Analytics & insights</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.tabActive]}
          onPress={() => setActiveTab('reports')}
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>Reports</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'insights' && styles.tabActive]}
          onPress={() => setActiveTab('insights')}
        >
          <Text style={[styles.tabText, activeTab === 'insights' && styles.tabTextActive]}>Cohort Insights</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
        >
          {activeTab === 'reports' ? (
            reports.length === 0 ? (
              <EmptyState icon="document-text-outline" text="No reports available" />
            ) : (
              reports.map(r => (
                <View key={r._id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <View style={styles.reportIcon}>
                      <Ionicons name="document-text" size={18} color={Colors.teal} />
                    </View>
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportTitle}>{r.title ?? r.type}</Text>
                      <Text style={styles.reportDate}>{new Date(r.createdAt).toLocaleDateString()}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: r.status === 'completed' ? Colors.riskLow + '22' : Colors.amber + '22' }]}>
                      <Text style={[styles.statusText, { color: r.status === 'completed' ? Colors.riskLow : Colors.amber }]}>
                        {r.status}
                      </Text>
                    </View>
                  </View>
                  {r.data && Object.keys(r.data).length > 0 && (
                    <View style={styles.reportData}>
                      {Object.entries(r.data).slice(0, 4).map(([k, v]) => (
                        <View key={k} style={styles.dataRow}>
                          <Text style={styles.dataKey}>{k.replace(/_/g, ' ')}</Text>
                          <Text style={styles.dataVal}>{String(v)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )
          ) : (
            insights.length === 0 ? (
              <EmptyState icon="analytics-outline" text="No cohort insights available" />
            ) : (
              insights.map((ins, i) => (
                <View key={i} style={styles.insightCard}>
                  <Text style={styles.insightTitle}>Cohort {ins.cohortId ?? i + 1}</Text>
                  <View style={styles.insightStats}>
                    <InsightStat label="Students" value={ins.totalStudents ?? 0} color={Colors.teal} />
                    <InsightStat label="High Risk" value={ins.highRiskCount ?? 0} color={Colors.riskHigh} />
                    <InsightStat label="Avg Risk" value={`${Math.round((ins.avgRiskScore ?? 0) * 100)}%`} color={Colors.riskModerate} />
                  </View>
                  {ins.avgRiskScore !== undefined && (
                    <View style={styles.riskBarBg}>
                      <View style={[styles.riskBar, {
                        width: `${Math.round(ins.avgRiskScore * 100)}%`,
                        backgroundColor: ins.avgRiskScore > 0.6 ? Colors.riskHigh : ins.avgRiskScore > 0.3 ? Colors.riskModerate : Colors.riskLow
                      }]} />
                    </View>
                  )}
                </View>
              ))
            )
          )}
        </ScrollView>
      )}
    </View>
  )
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon as any} size={40} color={Colors.textMuted} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  )
}

function InsightStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={styles.insightStat}>
      <Text style={[styles.insightStatVal, { color }]}>{value}</Text>
      <Text style={styles.insightStatLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  tabs: {
    flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    backgroundColor: '#141414DC', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.sm },
  tabActive: { backgroundColor: Colors.teal },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  tabTextActive: { color: Colors.background, fontWeight: FontWeight.semibold },
  content: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 40 },
  reportCard: {
    backgroundColor: '#121212E5', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  reportIcon: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: Colors.teal + '18', alignItems: 'center', justifyContent: 'center',
  },
  reportInfo: { flex: 1 },
  reportTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary, textTransform: 'capitalize' },
  reportDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  reportData: { gap: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: Colors.border },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dataKey: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'capitalize' },
  dataVal: { fontSize: FontSize.xs, color: Colors.textSecondary },
  insightCard: {
    backgroundColor: '#121212E5', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  insightTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  insightStats: { flexDirection: 'row', gap: Spacing.lg },
  insightStat: { alignItems: 'center', gap: 2 },
  insightStatVal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  insightStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  riskBarBg: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  riskBar: { height: '100%', borderRadius: 3 },
  empty: { alignItems: 'center', gap: Spacing.md, paddingTop: 60 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.md },
})
