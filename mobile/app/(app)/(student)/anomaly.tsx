import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import api, { mlApi } from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

interface AnomalyFlag {
  feature: string
  label: string
  current_value: number
  historical_mean: number
  z_score: number
  direction: string
  severity: 'high' | 'moderate'
}

interface AnomalyResult {
  anomaly_detected: boolean
  severity: string
  flags: AnomalyFlag[]
  n_anomalies: number
}

export default function AnomalyScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [result, setResult] = useState<AnomalyResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setInfoMessage(null)
    try {
      const studentId = user?.studentId
      if (!studentId) return

      // Fetch self-reports
      const srRes = await api.get('/self-reports', { params: { limit: 7 } }).catch(() => null)
      if (!srRes) {
        setResult(null)
        setInfoMessage('Unable to load check-in history')
        return
      }

      // Fetch current features
      const featRes = await api.get(`/features/${studentId}`).catch(() => null)

      // Parse history from self-reports
      const reportsList: any[] = Array.isArray(srRes.data)
        ? srRes.data
        : srRes.data?.selfReports ?? srRes.data?.reports ?? []

      const history = reportsList
        .map((sr: any) => {
          try {
            return JSON.parse(sr?.notes || '{}')
          } catch {
            return {}
          }
        })
        .filter((h: Record<string, any>) => Object.keys(h).length > 4)

      // Check if enough history
      if (history.length < 2 || !featRes?.data) {
        setResult(null)
        setInfoMessage('Log more check-ins to detect anomalies')
        return
      }

      // Build and send payload
      const payload = {
        current: featRes.data,
        history,
      }

      const mlRes = await mlApi.post('/anomaly', payload)
      const anomalyData = mlRes.data ?? {}
      const sortedFlags = Array.isArray(anomalyData.flags)
        ? [...anomalyData.flags].sort((a: AnomalyFlag, b: AnomalyFlag) => {
            const rank = (sev: string) => (sev === 'high' ? 2 : sev === 'moderate' ? 1 : 0)
            return rank(b?.severity) - rank(a?.severity)
          })
        : []

      setResult({
        anomaly_detected: Boolean(anomalyData.anomaly_detected),
        severity: String(anomalyData.severity ?? 'none'),
        flags: sortedFlags,
        n_anomalies: Number(anomalyData.n_anomalies ?? sortedFlags.length ?? 0),
      })
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to load anomaly data')
      setResult(null)
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

  const severityColor = result?.severity === 'high'
    ? Colors.riskHigh
    : result?.severity === 'moderate'
    ? Colors.riskModerate
    : Colors.riskLow

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Anomaly Pulse</Text>
          <Text style={styles.subtitle}>Behavioral shift detection</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : infoMessage ? (
        <View style={styles.emptyInfoBox}>
          <Ionicons name="time-outline" size={30} color={Colors.amber} />
          <Text style={styles.emptyInfoText}>{infoMessage}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
        >
          {/* Status card */}
          <View style={[styles.statusCard, { borderColor: severityColor }]}>
            <View style={[styles.statusIcon, { backgroundColor: severityColor + '22' }]}>
              <Ionicons
                name={result?.anomaly_detected ? 'warning' : 'checkmark-circle'}
                size={28}
                color={severityColor}
              />
            </View>
            <View style={styles.statusText}>
              <Text style={[styles.statusTitle, { color: severityColor }]}>
                {result?.anomaly_detected
                  ? `${result.severity.charAt(0).toUpperCase() + result.severity.slice(1)} Anomaly Detected`
                  : 'No Anomalies Detected'}
              </Text>
              <Text style={styles.statusDesc}>
                {result?.anomaly_detected
                  ? `${result.n_anomalies} behavioral shift${result.n_anomalies !== 1 ? 's' : ''} found vs your recent history`
                  : 'Your behavior patterns are consistent with recent history'}
              </Text>
            </View>
          </View>

          {/* Flags */}
          {result?.flags && result.flags.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Detected Shifts</Text>
              {result.flags.map((flag, i) => (
                <View key={i} style={styles.flagCard}>
                  <View style={styles.flagHeader}>
                    <Text style={styles.flagLabel}>{flag.label}</Text>
                    <View style={[
                      styles.severityBadge,
                      { backgroundColor: flag.severity === 'high' ? Colors.riskHigh + '22' : Colors.riskModerate + '22' }
                    ]}>
                      <Text style={[
                        styles.severityText,
                        { color: flag.severity === 'high' ? Colors.riskHigh : Colors.riskModerate }
                      ]}>
                        {flag.severity}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.flagValues}>
                    <View style={styles.flagVal}>
                      <Text style={styles.flagValLabel}>Current</Text>
                      <Text style={styles.flagValNum}>{flag.current_value.toFixed(2)}</Text>
                    </View>
                    <Ionicons
                      name={flag.direction === 'increased' ? 'arrow-up' : 'arrow-down'}
                      size={18}
                      color={flag.direction === 'increased' ? Colors.riskHigh : Colors.riskLow}
                    />
                    <View style={styles.flagVal}>
                      <Text style={styles.flagValLabel}>Avg</Text>
                      <Text style={styles.flagValNum}>{flag.historical_mean.toFixed(2)}</Text>
                    </View>
                    <View style={styles.flagVal}>
                      <Text style={styles.flagValLabel}>Z-score</Text>
                      <Text style={[styles.flagValNum, { color: Colors.amber }]}>
                        {flag.z_score > 0 ? '+' : ''}{flag.z_score.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.flagDesc}>
                    Your {flag.label.toLowerCase()} has {flag.direction} significantly compared to your recent average.
                  </Text>
                </View>
              ))}
            </>
          )}

          {/* No anomalies empty state */}
          {result && !result.anomaly_detected && (
            <View style={styles.allGood}>
              <Ionicons name="shield-checkmark-outline" size={48} color={Colors.riskLow} />
              <Text style={styles.allGoodText}>No unusual patterns detected</Text>
              <Text style={styles.allGoodSub}>Keep up your current habits to maintain this stability.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
  },
  backBtn: { padding: 4 },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.xs, color: Colors.textMuted },
  content: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.md },
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#121212E4', borderRadius: Radius.lg,
    borderWidth: 1, padding: Spacing.lg,
  },
  statusIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  statusText: { flex: 1, gap: 4 },
  statusTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  statusDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold,
    color: Colors.textSecondary, marginTop: Spacing.sm,
  },
  flagCard: {
    backgroundColor: '#121212E4', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  flagHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flagLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  severityBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  severityText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  flagValues: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  flagVal: { alignItems: 'center', gap: 2 },
  flagValLabel: { fontSize: 10, color: Colors.textMuted },
  flagValNum: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  flagDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  allGood: { alignItems: 'center', gap: Spacing.md, paddingTop: 40 },
  allGoodText: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.riskLow },
  allGoodSub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  emptyInfoBox: { alignItems: 'center', gap: Spacing.md, paddingTop: 60, paddingHorizontal: Spacing.lg },
  emptyInfoText: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
  errorBox: { alignItems: 'center', gap: Spacing.md, paddingTop: 60 },
  errorText: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
  retryBtn: { backgroundColor: Colors.teal, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  retryText: { color: Colors.background, fontWeight: FontWeight.bold },
})
