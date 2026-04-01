import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert
} from 'react-native'
import api from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}

function NumericField({ label, value, min, max, onChange }: SliderFieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
      <View style={styles.stepRow}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onChange(Math.max(min, value - 0.5))}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.stepBarBg}>
          <View style={[styles.stepBar, { width: `${((value - min) / (max - min)) * 100}%` }]} />
        </View>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onChange(Math.min(max, value + 0.5))}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>{min} – {max}</Text>
    </View>
  )
}

export default function CheckinScreen() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'report' | 'activity' | 'session'>('report')
  const [submitting, setSubmitting] = useState(false)

  // Self-report fields
  const [sleepHours, setSleepHours] = useState(7)
  const [stressScore, setStressScore] = useState(5)
  const [loadScore, setLoadScore] = useState(5)
  const [notes, setNotes] = useState('')

  // Activity log fields
  const [activityType, setActivityType] = useState('study')
  const [activityNotes, setActivityNotes] = useState('')

  // Session fields
  const [sessionDuration, setSessionDuration] = useState(60)
  const [sessionNotes, setSessionNotes] = useState('')

  async function submitReport() {
    setSubmitting(true)
    try {
      const studentId = user?.studentId
      await api.post('/self-reports', {
        studentId,
        sleepHours,
        stressScore,
        loadScore,
        notes,
      })
      Alert.alert('Done', 'Check-in submitted!')
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitActivity() {
    setSubmitting(true)
    try {
      const studentId = user?.studentId
      // Map UI activity types to valid API enum values
      const typeMap: Record<string, string> = {
        study: 'study',
        exercise: 'study',
        social: 'study',
        rest: 'study',
        other: 'study',
      }
      await api.post('/activity', {
        studentId,
        type: typeMap[activityType] || 'study',
        notes: activityNotes,
      })
      Alert.alert('Done', 'Activity logged!')
      setActivityNotes('')
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to log activity')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitSession() {
    setSubmitting(true)
    try {
      const studentId = user?.studentId
      const now = new Date()
      const startAt = new Date(now.getTime() - sessionDuration * 60 * 1000)
      await api.post('/sessions', {
        studentId,
        startAt: startAt.toISOString(),
        endAt: now.toISOString(),
      })
      Alert.alert('Done', 'Session logged!')
      setSessionNotes('')
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to log session')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>Check-in</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        {(['report', 'activity', 'session'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'report' ? 'Self Report' : t === 'activity' ? 'Activity' : 'Session'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {tab === 'report' && (
          <View style={styles.section}>
            <NumericField label="Sleep hours" value={sleepHours} min={3} max={12} onChange={setSleepHours} />
            <NumericField label="Stress level (1–10)" value={stressScore} min={1} max={10} onChange={setStressScore} />
            <NumericField label="Workload feeling (1–10)" value={loadScore} min={1} max={10} onChange={setLoadScore} />
            <View style={styles.field}>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="How are you feeling today?"
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>
            <TouchableOpacity style={[styles.btn, submitting && styles.btnDisabled]} onPress={submitReport} disabled={submitting}>
              {submitting ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.btnText}>Submit Check-in</Text>}
            </TouchableOpacity>
          </View>
        )}

        {tab === 'activity' && (
          <View style={styles.section}>
            <View style={styles.field}>
              <Text style={styles.label}>Activity Type</Text>
              <View style={styles.chipRow}>
                {['study', 'exercise', 'social', 'rest', 'other'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, activityType === t && styles.chipActive]}
                    onPress={() => setActivityType(t)}
                  >
                    <Text style={[styles.chipText, activityType === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={activityNotes}
                onChangeText={setActivityNotes}
                placeholder="What did you do?"
                placeholderTextColor={Colors.textMuted}
                multiline
              />
            </View>
            <TouchableOpacity style={[styles.btn, submitting && styles.btnDisabled]} onPress={submitActivity} disabled={submitting}>
              {submitting ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.btnText}>Log Activity</Text>}
            </TouchableOpacity>
          </View>
        )}

        {tab === 'session' && (
          <View style={styles.section}>
            <NumericField label="Session duration (minutes)" value={sessionDuration} min={15} max={480} onChange={setSessionDuration} />
            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={sessionNotes}
                onChangeText={setSessionNotes}
                placeholder="What did you study?"
                placeholderTextColor={Colors.textMuted}
                multiline
              />
            </View>
            <TouchableOpacity style={[styles.btn, submitting && styles.btnDisabled]} onPress={submitSession} disabled={submitting}>
              {submitting ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.btnText}>Log Session</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, paddingTop: 56 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  tab: {
    flex: 1, padding: Spacing.sm, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: '#131313D6',
  },
  tabActive: { borderColor: Colors.teal, backgroundColor: Colors.teal + '22' },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  tabTextActive: { color: Colors.teal, fontWeight: FontWeight.semibold },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  section: { gap: Spacing.md },
  field: { gap: 4 },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  fieldValue: { fontSize: FontSize.sm, color: Colors.teal, fontWeight: FontWeight.bold },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#171717F0', borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  stepBarBg: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  stepBar: { height: '100%', backgroundColor: Colors.teal, borderRadius: 3 },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted },
  input: {
    backgroundColor: '#131313E6', borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md, color: Colors.textPrimary, fontSize: FontSize.md,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: '#131313DE',
  },
  chipActive: { borderColor: Colors.teal, backgroundColor: Colors.teal + '22' },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTextActive: { color: Colors.teal },
  btn: {
    backgroundColor: Colors.teal, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: FontWeight.bold },
})
