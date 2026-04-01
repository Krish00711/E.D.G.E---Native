import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore, UserRole } from '../../store/authStore'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme'
import EdgeBackdrop from '../../components/EdgeBackdrop'

const ROLES: { label: string; value: UserRole }[] = [
  { label: 'Student', value: 'student' },
  { label: 'Mentor', value: 'mentor' },
  { label: 'Admin', value: 'admin' },
]

export default function RegisterScreen() {
  const router = useRouter()
  const { register, isLoading } = useAuthStore()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [major, setMajor] = useState('')
  const [cohortId, setCohortId] = useState('')

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Name, email and password are required')
      return
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters')
      return
    }
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        major: major.trim() || undefined,
        cohortId: cohortId.trim() || `cohort-${new Date().getFullYear()}`,
        consented: true,
      })
      // Navigation handled by root layout (_layout.tsx) based on role + onboardingComplete
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Registration failed.'
      Alert.alert('Registration Failed', msg)
    }
  }

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>E.D.G.E.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>I am :</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleBtn, role === r.value && styles.roleBtnActive]}
                  onPress={() => setRole(r.value)}
                >
                  <Text style={[styles.roleBtnText, role === r.value && styles.roleBtnTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Name :</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName}
              placeholder="John Smith" placeholderTextColor={Colors.textMuted} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email :</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail}
              placeholder="you@university.edu" placeholderTextColor={Colors.textMuted}
              keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password :</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword}
              placeholder="Min 8 characters" placeholderTextColor={Colors.textMuted}
              secureTextEntry />
          </View>

          {role === 'student' && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Major(optional) :</Text>
                <TextInput style={styles.input} value={major} onChangeText={setMajor}
                  placeholder="Computer Science" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Cohort ID (optional) :</Text>
                <TextInput style={styles.input} value={cohortId} onChangeText={setCohortId}
                  placeholder={`cohort-${new Date().getFullYear()}`} placeholderTextColor={Colors.textMuted} />
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.btn, isLoading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color={Colors.background} />
              : <Text style={styles.btnText}>
                  {role === 'student' ? 'Continue' : 'Create Account'}
                </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>Already have an account? <Text style={styles.linkAccent}>Login</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: 52, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: Spacing.lg },
  logo: {
    fontSize: 50,
    fontWeight: FontWeight.bold,
    color: Colors.teal,
    letterSpacing: 4,
    fontFamily: 'Georgia',
  },
  form: { gap: Spacing.md },
  field: { gap: Spacing.sm },
  label: {
    fontSize: 18,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
    fontFamily: 'Georgia',
  },
  input: {
    backgroundColor: '#7F5A08CC',
    borderWidth: 1,
    borderColor: '#8C6A1D',
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: 'Georgia',
  },
  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#8C6A1D',
    backgroundColor: '#8A6A1A99',
    alignItems: 'center',
  },
  roleBtnActive: { borderColor: Colors.teal, backgroundColor: Colors.teal },
  roleBtnText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: FontWeight.semibold,
    fontFamily: 'Georgia',
  },
  roleBtnTextActive: { color: '#1A1404' },
  btn: {
    backgroundColor: Colors.teal,
    borderRadius: Radius.full,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#1A1404',
    fontSize: 18,
    fontWeight: FontWeight.bold,
    fontFamily: 'Georgia',
  },
  link: {
    textAlign: 'center',
    color: Colors.textPrimary,
    fontSize: 15,
    marginTop: Spacing.sm,
    fontFamily: 'Georgia',
  },
  linkAccent: {
    color: Colors.teal,
    fontWeight: FontWeight.semibold,
    textDecorationLine: 'underline',
  },
})
