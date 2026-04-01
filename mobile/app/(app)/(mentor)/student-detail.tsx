import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight, riskColor } from '../../../constants/theme'

interface StudentProfile {
  _id?: string
  userId?: { name?: string; email?: string }
  name?: string
  email?: string
  major?: string
  program?: string
  year?: number
}

interface Prediction {
  _id?: string
  riskLevel?: string
  riskScore?: number
  exhaustionScore?: number
  cynicismScore?: number
  efficacyScore?: number
  dimensionScores?: {
    exhaustion?: number
    cynicism?: number
    efficacy?: number
  }
  createdAt?: string
}

interface ForecastData {
  trend?: string
  forecast?: Array<{ projected_risk_score?: number }>
}

interface InterventionItem {
  _id?: string
  type?: string
  status?: string
  createdAt?: string
}

export default function StudentDetailScreen() {
  const router = useRouter()
  const { studentId } = useLocalSearchParams<{ studentId: string }>()

  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [interventions, setInterventions] = useState<InterventionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!studentId) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    try {
      const [studentRes, predictionRes, forecastRes, interventionsRes] = await Promise.all([
        api.get(`/admin/students/${studentId}`),
        api.get(`/predictions/latest/${studentId}`),
        api.get(`/predictions/forecast/${studentId}`).catch(() => null),
        api.get(`/interventions/student/${studentId}`),
      ])

      const studentData = studentRes?.data
      const predictionData = predictionRes?.data
      const forecastData = forecastRes?.data ?? null
      const interventionsData = interventionsRes?.data

      setStudent(studentData ?? null)
      setPrediction(predictionData ?? null)
      setForecast(forecastData)
      setInterventions(Array.isArray(interventionsData)
        ? interventionsData
        : interventionsData?.interventions ?? [])
    } catch {
      setStudent(null)
      setPrediction(null)
      setForecast(null)
      setInterventions([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [studentId])

  useEffect(() => { load() }, [load])

  async function createIntervention() {
    if (!studentId) return
    setCreating(true)
    try {
      await api.post('/interventions', {
        studentId,
        type: 'counseling',
        title: 'Mentor Counseling Check-In',
        description: 'Mentor initiated intervention for follow-up and support.',
        actionItems: ['Schedule a check-in call', 'Review stress and workload patterns'],
        priority: 'medium',
        severity: 'moderate',
      })
      Alert.alert('Success', 'Intervention created successfully')
      load()
    } catch {
      Alert.alert('Error', 'Failed to create intervention')
    } finally {
      setCreating(false)
    }
  }

  function onRefresh() {
    setRefreshing(true)
    load()
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.teal} />
      </View>
    )
  }

  const name = String(student?.userId?.name ?? student?.name ?? 'Unknown')
  const email = String(student?.userId?.email ?? student?.email ?? '')
  const major = String(student?.major ?? '')

  const riskLevel = String(prediction?.riskLevel ?? 'unknown')
  const riskScore = Number(prediction?.riskScore ?? 0)
  const riskBadgeColor = riskColor(prediction?.riskLevel)

  const exhaustion = Number(prediction?.exhaustionScore ?? prediction?.dimensionScores?.exhaustion ?? 0)
  const cynicism = Number(prediction?.cynicismScore ?? prediction?.dimensionScores?.cynicism ?? 0)
  const efficacy = Number(prediction?.efficacyScore ?? prediction?.dimensionScores?.efficacy ?? 0)
  
  const firstName = name ? name.charAt(0).toUpperCase() : ''
  const trendRaw = String(forecast?.trend ?? 'stable').toUpperCase()
  const trendColor = trendRaw === 'IMPROVING'
    ? Colors.riskLow
    : trendRaw === 'WORSENING'
    ? Colors.riskHigh
    : Colors.textSecondary

  return (
    <View style={styles.container}>
      <EdgeBackdrop />

      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
      >
        {/* Header: student profile + risk badge */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: riskBadgeColor + '22' }]}>
            <Text style={[styles.avatarText, { color: riskBadgeColor }]}>{firstName}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{name}</Text>
            <Text style={styles.profileEmail}>{email}</Text>
            <Text style={styles.profileMeta}>{major}</Text>
          </View>
          <View style={[styles.riskBadge, { backgroundColor: riskBadgeColor + '22' }]}>
            <Text style={[styles.riskBadgeText, { color: riskBadgeColor }]}>{riskLevel.toUpperCase()}</Text>
            <Text style={[styles.riskBadgeScore, { color: riskBadgeColor }]}>{Math.round(riskScore * 100) + '%'}</Text>
          </View>
        </View>

        {/* Risk card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk Assessment</Text>
          <View style={styles.riskCard}>
            <View style={styles.riskTop}>
              <Text style={[styles.riskLevelText, { color: riskBadgeColor }]}>{riskLevel.toUpperCase()}</Text>
              <Text style={styles.riskScoreText}>{Math.round(riskScore * 100) + '%'}</Text>
            </View>

            {[
              { label: 'Exhaustion', value: exhaustion, color: Colors.exhaustion },
              { label: 'Cynicism', value: cynicism, color: Colors.cynicism },
              { label: 'Efficacy', value: efficacy, color: Colors.efficacy },
            ].map((d) => (
              <View key={d.label} style={styles.dimRow}>
                <Text style={styles.dimLabel}>{String(d.label)}</Text>
                <View style={styles.dimBarBg}>
                  <View style={[styles.dimBar, { width: `${Math.round(d.value * 100)}%`, backgroundColor: d.color }]} />
                </View>
                <Text style={[styles.dimValue, { color: d.color }]}>{Math.round(d.value * 100) + '%'}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Forecast trend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Forecast Trend</Text>
          <View style={styles.trendCard}>
            <Text style={styles.trendLabel}>Current Trend</Text>
            <Text style={[styles.trendValue, { color: trendColor }]}>{trendRaw}</Text>
          </View>
        </View>

        {/* Interventions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interventions</Text>
          {interventions.length === 0 ? (
            <Text style={styles.emptyText}>No interventions yet</Text>
          ) : (
            interventions.map((iv, idx) => (
              <View key={String(iv?._id ?? idx)} style={styles.interventionCard}>
                <View style={styles.interventionTop}>
                  <Text style={styles.interventionType}>{String(iv?.type ?? '—')}</Text>
                  <Text style={styles.interventionStatus}>{String(iv?.status ?? '—')}</Text>
                </View>
                <Text style={styles.interventionDate}>{iv?.createdAt ? new Date(iv.createdAt).toLocaleDateString() : '—'}</Text>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.createBtn} onPress={createIntervention} disabled={creating}>
          {creating ? (
            <ActivityIndicator size="small" color={Colors.background} />
          ) : (
            <Text style={styles.createBtnText}>Create Intervention</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  headerTop: { paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 40, gap: Spacing.md },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#131313E5',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  profileEmail: { fontSize: FontSize.xs, color: Colors.textMuted },
  profileMeta: { fontSize: FontSize.xs, color: Colors.textSecondary },
  riskBadge: { alignItems: 'center', borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  riskBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  riskBadgeScore: { fontSize: 10, marginTop: 2, fontWeight: FontWeight.semibold },

  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  riskCard: {
    backgroundColor: '#121212E5',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  riskTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  riskLevelText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  riskScoreText: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  dimRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dimLabel: { width: 78, fontSize: FontSize.xs, color: Colors.textSecondary },
  dimBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden' },
  dimBar: { height: '100%', borderRadius: 3 },
  dimValue: { width: 42, textAlign: 'right', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  trendCard: {
    backgroundColor: '#121212E5',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  trendValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },

  interventionCard: {
    backgroundColor: '#121212E5',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
  },
  interventionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  interventionType: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  interventionStatus: { fontSize: FontSize.xs, color: Colors.amber, textTransform: 'capitalize' },
  interventionDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },

  createBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.teal,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  createBtnText: { color: Colors.background, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
})
