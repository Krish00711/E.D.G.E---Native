import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { useRouter } from 'expo-router'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme'
import EdgeBackdrop from '../../components/EdgeBackdrop'

// 24 features split into 4 steps
const STEPS = [
  {
    title: 'Sleep & Stress',
    subtitle: 'Tell us about your daily wellbeing',
    fields: [
      { key: 'sleep_hours', label: 'Sleep hours per night', min: 3, max: 12, placeholder: '7' },
      { key: 'stress_score', label: 'Stress level (1–10)', min: 1, max: 10, placeholder: '5' },
      { key: 'load_score', label: 'Workload feeling (1–10)', min: 1, max: 10, placeholder: '5' },
      { key: 'sleep_quality', label: 'Sleep quality (1–5)', min: 1, max: 5, placeholder: '3' },
      { key: 'anxiety_score', label: 'Anxiety level (0–10)', min: 0, max: 10, placeholder: '4' },
      { key: 'mood_score', label: 'Mood score (0–10)', min: 0, max: 10, placeholder: '6' },
    ],
  },
  {
    title: 'Academic Habits',
    subtitle: 'How are your studies going?',
    fields: [
      { key: 'gpa', label: 'Current GPA (0–4)', min: 0, max: 4, placeholder: '3.0' },
      { key: 'attendance_rate', label: 'Attendance rate (%)', min: 0, max: 100, placeholder: '80' },
      { key: 'assignment_completion_rate', label: 'Assignment completion (%)', min: 0, max: 100, placeholder: '85' },
      { key: 'quiz_scores', label: 'Average quiz score (%)', min: 0, max: 100, placeholder: '75' },
      { key: 'submission_lateness', label: 'Avg days late on submissions', min: 0, max: 14, placeholder: '1' },
      { key: 'grade_trend', label: 'Grade trend (-15 to +15)', min: -15, max: 15, placeholder: '0' },
    ],
  },
  {
    title: 'Activity & Engagement',
    subtitle: 'How active are you day-to-day?',
    fields: [
      { key: 'session_duration', label: 'Avg study session (minutes)', min: 30, max: 480, placeholder: '120' },
      { key: 'activity_frequency', label: 'Study sessions per week', min: 1, max: 20, placeholder: '5' },
      { key: 'days_since_last_activity', label: 'Days since last study session', min: 0, max: 30, placeholder: '1' },
      { key: 'physical_activity_hours', label: 'Physical activity (hrs/day)', min: 0, max: 8, placeholder: '1' },
      { key: 'social_interaction_hours', label: 'Social interaction (hrs/day)', min: 0, max: 8, placeholder: '2' },
    ],
  },
  {
    title: 'Lifestyle & Pressure',
    subtitle: 'A few more things that affect burnout',
    fields: [
      { key: 'screen_time_hours', label: 'Screen time (hrs/day)', min: 0, max: 16, placeholder: '4' },
      { key: 'social_media_hours', label: 'Social media (hrs/day)', min: 0, max: 12, placeholder: '2' },
      { key: 'academic_pressure_score', label: 'Academic pressure (1–10)', min: 1, max: 10, placeholder: '6' },
      { key: 'extracurricular_load', label: 'Extracurricular load (0–8)', min: 0, max: 8, placeholder: '2' },
      { key: 'placement_pressure', label: 'Placement/career pressure (1–10)', min: 1, max: 10, placeholder: '5' },
      { key: 'peer_stress', label: 'Peer comparison stress (1–10)', min: 1, max: 10, placeholder: '5' },
      { key: 'financial_stress', label: 'Financial stress (1–10)', min: 1, max: 10, placeholder: '4' },
    ],
  },
]

type FormData = Record<string, string>

export default function OnboardingScreen() {
  const router = useRouter()
  const { user, hydrate } = useAuthStore()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentStep = STEPS[step]
  const isLast = step === STEPS.length - 1

  function setValue(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validateStep(): boolean {
    for (const field of currentStep.fields) {
      const raw = form[field.key]
      if (raw === undefined || raw === '') {
        Alert.alert('Missing field', `Please fill in: ${field.label}`)
        return false
      }
      const num = parseFloat(raw)
      if (isNaN(num) || num < field.min || num > field.max) {
        Alert.alert('Invalid value', `${field.label} must be between ${field.min} and ${field.max}`)
        return false
      }
    }
    return true
  }

  function handleNext() {
    if (!validateStep()) return
    if (isLast) {
      handleSubmit()
    } else {
      setStep((s) => s + 1)
    }
  }

  async function handleSubmit() {
    setIsSubmitting(true)
    try {
      // Convert all values to numbers
      const payload: Record<string, number> = {}
      for (const stepDef of STEPS) {
        for (const field of stepDef.fields) {
          payload[field.key] = parseFloat(form[field.key] || '0')
        }
      }
      await api.post('/onboarding/submit', payload)
      // Refresh user in store so onboardingComplete is updated
      await hydrate()
      router.replace('/(app)/(student)/dashboard')
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Onboarding failed. Please try again.'
      Alert.alert('Error', msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <EdgeBackdrop />

      <View style={styles.progressBar}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[styles.progressSegment, i <= step && styles.progressSegmentActive]}
          />
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepLabel}>Step {step + 1} of {STEPS.length}</Text>
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.subtitle}>{currentStep.subtitle}</Text>

        <View style={styles.fields}>
          {currentStep.fields.map((field) => (
            <View key={field.key} style={styles.field}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                style={styles.input}
                value={form[field.key] || ''}
                onChangeText={(v) => setValue(field.key, v)}
                placeholder={field.placeholder}
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
              <Text style={styles.hint}>Range: {field.min} - {field.max}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, isSubmitting && styles.btnDisabled]}
          onPress={handleNext}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? <ActivityIndicator color={Colors.background} />
            : <Text style={styles.nextBtnText}>{isLast ? 'Finish Setup' : 'Next'}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { backgroundColor: 'transparent' },
  progressBar: { flexDirection: 'row', gap: 4, padding: Spacing.md, paddingTop: 56 },
  progressSegment: {
    flex: 1, height: 4, borderRadius: 2, backgroundColor: '#3A2A06',
  },
  progressSegmentActive: { backgroundColor: Colors.teal },
  content: { padding: Spacing.lg, paddingBottom: 120 },
  stepLabel: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.xs, fontFamily: 'Georgia' },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.teal, fontFamily: 'Georgia' },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.lg },
  fields: { gap: Spacing.md },
  field: { gap: 4 },
  label: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  input: {
    backgroundColor: '#7F5A08BB',
    borderWidth: 1,
    borderColor: '#8C6A1D',
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: Spacing.sm,
    padding: Spacing.lg, backgroundColor: '#0B0B0BDD',
    borderTopWidth: 1, borderTopColor: '#4D390C',
  },
  backBtn: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1, borderColor: '#8C6A1D', alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  backBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: FontWeight.medium },
  nextBtn: {
    flex: 2, backgroundColor: Colors.teal,
    padding: Spacing.md, borderRadius: Radius.md, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  nextBtnText: { color: '#1A1404', fontSize: FontSize.md, fontWeight: FontWeight.bold },
})
