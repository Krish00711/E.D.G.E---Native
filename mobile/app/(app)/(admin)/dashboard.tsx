import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import api, { mlApi } from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { RiskDonut, Sparkline } from '../../../components/EdgeCharts'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

interface SystemStats {
  totalStudents?: number
  totalMentors?: number
  totalPredictions?: number
  highRiskCount?: number
  moderateRiskCount?: number
  lowRiskCount?: number
}

interface ModelMeta {
  version?: string
  accuracy?: number
  f1_score?: number
  trained_at?: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [stats, setStats] = useState<SystemStats>({})
  const [modelMeta, setModelMeta] = useState<ModelMeta>({})
  const [retrainStatus, setRetrainStatus] = useState<string>('idle')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const [statsRes, metaRes] = await Promise.allSettled([
        api.get('/admin/dashboard/overview'),
        mlApi.get('/models/performance'),
      ])

      if (statsRes.status === 'fulfilled') {
        const d = statsRes.value.data
        setStats({
          totalStudents: d?.summary?.totalStudents,
          totalMentors: 0,
          totalPredictions: 0,
          highRiskCount: d?.riskDistribution?.high,
          moderateRiskCount: d?.riskDistribution?.moderate,
          lowRiskCount: d?.riskDistribution?.low,
        })
      }
      if (metaRes.status === 'fulfilled') setModelMeta(metaRes.value.data)
    } catch {
      // show empty state
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function onRefresh() { setRefreshing(true); load() }

  async function triggerRetrain() {
    Alert.alert(
      'Retrain Model',
      'This will trigger a full model retraining. It may take several minutes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retrain',
          onPress: async () => {
            try {
              await api.post('/admin/retrain')
              setRetrainStatus('running')
              // Poll status via ML service
              const poll = setInterval(async () => {
                try {
                  const res = await mlApi.get('/retrain/status')
                  setRetrainStatus(res.data.status)
                  if (res.data.status !== 'running') {
                    clearInterval(poll)
                    load()
                  }
                } catch { clearInterval(poll) }
              }, 5000)
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message ?? 'Failed to start retraining')
            }
          }
        }
      ]
    )
  }

  async function exportTrainingData() {
    try {
      await api.get('/admin/export/training-data', { params: { format: 'csv' } })
      Alert.alert('Export', 'Training data export initiated. Check your server logs.')
    } catch {
      Alert.alert('Error', 'Export failed')
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
    >
      <EdgeBackdrop />
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>System overview</Text>
        </View>
        <TouchableOpacity onPress={async () => { await logout(); router.replace('/(auth)/login') }}>
          <Ionicons name="log-out-outline" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* User stats */}
          <Text style={styles.sectionTitle}>Platform Stats</Text>
          <View style={styles.statsGrid}>
            <StatCard label="Students" value={stats.totalStudents ?? 0} icon="people" color={Colors.teal} />
            <StatCard label="Mentors" value={stats.totalMentors ?? 0} icon="person" color={Colors.amber} />
            <StatCard label="Predictions" value={stats.totalPredictions ?? 0} icon="analytics" color={Colors.cynicism} />
            <StatCard label="High Risk" value={stats.highRiskCount ?? 0} icon="warning" color={Colors.riskHigh} />
          </View>

          <View style={styles.quickViz}>
            <RiskDonut
              value={Math.min(1, (stats.highRiskCount ?? 0) / Math.max((stats.totalStudents ?? 1), 1))}
              size={84}
              color={Colors.riskHigh}
              trackColor={Colors.border + '66'}
            />
            <View style={styles.sparkWrap}>
              <Text style={styles.sparkTitle}>7-day Risk Drift</Text>
              <Sparkline values={[0.42, 0.46, 0.41, 0.49, 0.45, 0.44, 0.4]} color={Colors.amber} width={170} height={44} />
            </View>
          </View>

          {/* Risk distribution */}
          <Text style={styles.sectionTitle}>Risk Distribution</Text>
          <View style={styles.riskCard}>
            {[
              { label: 'High Risk', value: stats.highRiskCount ?? 0, color: Colors.riskHigh },
              { label: 'Moderate', value: stats.moderateRiskCount ?? 0, color: Colors.riskModerate },
              { label: 'Low Risk', value: stats.lowRiskCount ?? 0, color: Colors.riskLow },
            ].map(r => {
              const total = (stats.highRiskCount ?? 0) + (stats.moderateRiskCount ?? 0) + (stats.lowRiskCount ?? 0)
              const pct = total > 0 ? Math.round((r.value / total) * 100) : 0
              return (
                <View key={r.label} style={styles.riskRow}>
                  <Text style={styles.riskLabel}>{r.label}</Text>
                  <View style={styles.riskBarBg}>
                    <View style={[styles.riskBar, { width: `${pct}%`, backgroundColor: r.color }]} />
                  </View>
                  <Text style={[styles.riskPct, { color: r.color }]}>{pct}%</Text>
                </View>
              )
            })}
          </View>

          {/* ML Model */}
          <Text style={styles.sectionTitle}>ML Model</Text>
          <View style={styles.modelCard}>
            <View style={styles.modelRow}>
              <Text style={styles.modelLabel}>Version</Text>
              <Text style={styles.modelValue}>{modelMeta.version ?? 'Unknown'}</Text>
            </View>
            {modelMeta.accuracy !== undefined && (
              <View style={styles.modelRow}>
                <Text style={styles.modelLabel}>Accuracy</Text>
                <Text style={[styles.modelValue, { color: Colors.riskLow }]}>{(modelMeta.accuracy * 100).toFixed(1)}%</Text>
              </View>
            )}
            {modelMeta.f1_score !== undefined && (
              <View style={styles.modelRow}>
                <Text style={styles.modelLabel}>F1 Score</Text>
                <Text style={[styles.modelValue, { color: Colors.teal }]}>{modelMeta.f1_score.toFixed(3)}</Text>
              </View>
            )}
            {modelMeta.trained_at && (
              <View style={styles.modelRow}>
                <Text style={styles.modelLabel}>Trained</Text>
                <Text style={styles.modelValue}>{new Date(modelMeta.trained_at).toLocaleDateString()}</Text>
              </View>
            )}

            <View style={styles.modelStatus}>
              <View style={[styles.statusDot, { backgroundColor: retrainStatus === 'running' ? Colors.amber : retrainStatus === 'completed' ? Colors.riskLow : Colors.teal }]} />
              <Text style={styles.statusLabel}>
                {retrainStatus === 'running' ? 'Retraining in progress...' : retrainStatus === 'completed' ? 'Retrain complete' : 'Model ready'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.retrainBtn, retrainStatus === 'running' && styles.retrainBtnDisabled]}
              onPress={triggerRetrain}
              disabled={retrainStatus === 'running'}
            >
              <Ionicons name="refresh" size={16} color={retrainStatus === 'running' ? Colors.textMuted : Colors.background} />
              <Text style={[styles.retrainText, retrainStatus === 'running' && { color: Colors.textMuted }]}>
                {retrainStatus === 'running' ? 'Retraining...' : 'Retrain Model'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={exportTrainingData}>
              <Ionicons name="download-outline" size={22} color={Colors.teal} />
              <Text style={styles.actionLabel}>Export Training Data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(app)/(admin)/users')}>
              <Ionicons name="people-outline" size={22} color={Colors.amber} />
              <Text style={styles.actionLabel}>Manage Users</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(app)/(admin)/reports')}>
              <Ionicons name="document-text-outline" size={22} color={Colors.cynicism} />
              <Text style={styles.actionLabel}>View Reports</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderColor: color + '44' }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: 56, paddingBottom: 40, gap: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickViz: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#121212E0',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sparkWrap: { alignItems: 'flex-end', gap: 6 },
  sparkTitle: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  statCard: {
    width: '47%', backgroundColor: '#131313E0', borderRadius: Radius.md,
    borderWidth: 1, padding: Spacing.md, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  riskCard: {
    backgroundColor: '#131313E0', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  riskLabel: { width: 80, fontSize: FontSize.xs, color: Colors.textSecondary },
  riskBarBg: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  riskBar: { height: '100%', borderRadius: 3 },
  riskPct: { width: 36, fontSize: FontSize.xs, textAlign: 'right' },
  modelCard: {
    backgroundColor: '#131313E0', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  modelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modelLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  modelValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  modelStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  retrainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Colors.teal, borderRadius: Radius.md,
    padding: Spacing.md, marginTop: Spacing.xs,
  },
  retrainBtnDisabled: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  retrainText: { color: Colors.background, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionCard: {
    width: '47%', backgroundColor: '#131313E0', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
    alignItems: 'center', gap: Spacing.sm,
  },
  actionLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
})
