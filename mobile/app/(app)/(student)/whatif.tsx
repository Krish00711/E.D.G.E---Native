import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight, riskColor } from '../../../constants/theme'

const SIMULATABLE = [
  { key: 'sleep_hours', label: 'Sleep Hours', min: 3, max: 12, step: 0.5 },
  { key: 'stress_score', label: 'Stress Level', min: 1, max: 10, step: 0.5 },
  { key: 'load_score', label: 'Workload', min: 1, max: 10, step: 0.5 },
  { key: 'physical_activity_hours', label: 'Exercise (hrs/day)', min: 0, max: 4, step: 0.5 },
  { key: 'screen_time_hours', label: 'Screen Time (hrs)', min: 0, max: 12, step: 0.5 },
  { key: 'social_media_hours', label: 'Social Media (hrs)', min: 0, max: 8, step: 0.5 },
  { key: 'attendance_rate', label: 'Attendance (%)', min: 0, max: 100, step: 5 },
  { key: 'gpa', label: 'GPA', min: 0, max: 4, step: 0.1 },
]

export default function WhatIfScreen() {
  const { user } = useAuthStore()
  const [currentFeatures, setCurrentFeatures] = useState<Record<string, number>>({})
  const [changes, setChanges] = useState<Record<string, number>>({})
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [simulating, setSimulating] = useState(false)

  const load = useCallback(async () => {
    try {
      const studentId = user?.studentId
      if (!studentId) return
      const res = await api.get(`/features/${studentId}`)
      setCurrentFeatures(res.data || {})
      // Init changes to current values
      const init: Record<string, number> = {}
      for (const f of SIMULATABLE) {
        init[f.key] = res.data?.[f.key] ?? (f.min + f.max) / 2
      }
      setChanges(init)
    } catch {}
    finally { setLoading(false) }
  }, [user?.studentId])

  useEffect(() => { load() }, [load])

  function adjust(key: string, delta: number, step: number) {
    const field = SIMULATABLE.find((f) => f.key === key)
    if (!field) return
    setChanges((prev) => ({
      ...prev,
      [key]: Math.max(field.min, Math.min(field.max, parseFloat(((prev[key] || 0) + delta).toFixed(2)))),
    }))
    setResult(null)
  }

  async function simulate() {
    setSimulating(true)
    try {
      const studentId = user?.studentId
      if (!studentId) return
      const res = await api.post('/predictions/whatif', { studentId, changes })
      setResult(res.data)
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Simulation failed')
    } finally {
      setSimulating(false)
    }
  }

  function reset() {
    const init: Record<string, number> = {}
    for (const f of SIMULATABLE) {
      init[f.key] = currentFeatures[f.key] ?? (f.min + f.max) / 2
    }
    setChanges(init)
    setResult(null)
  }

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>What-If Simulator</Text>
        <Text style={styles.subtitle}>See how changes affect your burnout risk</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Result card */}
          {result && (
            <View style={[styles.resultCard, {
              borderColor: result.delta.risk_score_change < 0 ? Colors.success : Colors.error
            }]}>
              <Text style={styles.resultMessage}>{result.message}</Text>
              <View style={styles.resultRow}>
                <View style={styles.resultBox}>
                  <Text style={styles.resultBoxLabel}>Current</Text>
                  <Text style={[styles.resultBoxValue, { color: riskColor(result.current.risk_level) }]}>
                    {result.current.risk_level?.toUpperCase()}
                  </Text>
                  <Text style={styles.resultBoxScore}>{Math.round(result.current.risk_score * 100)}%</Text>
                </View>
                <Ionicons
                  name={result.delta.risk_score_change < 0 ? 'arrow-down' : 'arrow-up'}
                  size={24}
                  color={result.delta.risk_score_change < 0 ? Colors.success : Colors.error}
                />
                <View style={styles.resultBox}>
                  <Text style={styles.resultBoxLabel}>Simulated</Text>
                  <Text style={[styles.resultBoxValue, { color: riskColor(result.simulated.risk_level) }]}>
                    {result.simulated.risk_level?.toUpperCase()}
                  </Text>
                  <Text style={styles.resultBoxScore}>{Math.round(result.simulated.risk_score * 100)}%</Text>
                </View>
              </View>
            </View>
          )}

          {/* Feature sliders */}
          {SIMULATABLE.map((field) => {
            const current = currentFeatures[field.key] ?? 0
            const simVal = changes[field.key] ?? current
            const changed = Math.abs(simVal - current) > 0.01
            return (
              <View key={field.key} style={[styles.fieldCard, changed && styles.fieldCardChanged]}>
                <View style={styles.fieldHeader}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <View style={styles.fieldValues}>
                    {changed && (
                      <Text style={styles.fieldOriginal}>{current.toFixed(1)}</Text>
                    )}
                    <Text style={[styles.fieldValue, changed && styles.fieldValueChanged]}>
                      {simVal.toFixed(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.stepRow}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => adjust(field.key, -field.step, field.step)}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.barBg}>
                    <View style={[styles.bar, {
                      width: `${((simVal - field.min) / (field.max - field.min)) * 100}%`,
                      backgroundColor: changed ? Colors.amber : Colors.teal,
                    }]} />
                  </View>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => adjust(field.key, field.step, field.step)}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })}

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.resetBtn} onPress={reset}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.simBtn, simulating && styles.btnDisabled]}
              onPress={simulate}
              disabled={simulating}
            >
              {simulating
                ? <ActivityIndicator color={Colors.background} />
                : <Text style={styles.simBtnText}>Simulate</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, paddingTop: 56 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  content: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.md },
  resultCard: {
    backgroundColor: '#121212E6', borderRadius: Radius.lg,
    borderWidth: 1, padding: Spacing.lg, gap: Spacing.md,
  },
  resultMessage: { fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center', lineHeight: 22 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  resultBox: { alignItems: 'center', gap: 4 },
  resultBoxLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  resultBoxValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  resultBoxScore: { fontSize: FontSize.sm, color: Colors.textSecondary },
  fieldCard: {
    backgroundColor: '#131313DE', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  fieldCardChanged: { borderColor: Colors.amber + '88' },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  fieldValues: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  fieldOriginal: { fontSize: FontSize.sm, color: Colors.textMuted, textDecorationLine: 'line-through' },
  fieldValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  fieldValueChanged: { color: Colors.amber },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#1E1E1EDB', borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  barBg: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 3 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  resetBtn: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  resetBtnText: { color: Colors.textSecondary, fontSize: FontSize.md },
  simBtn: {
    flex: 2, backgroundColor: Colors.teal,
    padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  simBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
})
