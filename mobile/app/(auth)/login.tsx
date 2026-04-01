import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../store/authStore'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme'
import EdgeBackdrop from '../../components/EdgeBackdrop'

export default function LoginScreen() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password')
      return
    }
    try {
      await login(email.trim().toLowerCase(), password)
      // Navigation handled by root layout based on role
    } catch (err: any) {
      const msg = err?.response?.data?.error 
        || err?.message 
        || 'Login failed. Check your credentials.'
      Alert.alert('Login Failed', msg)
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
          <Text style={styles.tagline}>Early Detection of Gradual Exhaustion</Text>
        </View>

        {!showForm ? (
          <View style={styles.landingActions}>
            <TouchableOpacity style={styles.btn} onPress={() => setShowForm(true)}>
              <Text style={styles.btnText}>LOGIN</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.link}>Don't have an account?</Text>
              <Text style={styles.linkAccent}>Register</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Username:</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@university.edu"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password:</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, isLoading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color={Colors.background} />
                : <Text style={styles.btnText}>Enter</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={styles.backLink}>Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 78,
    paddingBottom: 72,
  },
  header: { alignItems: 'center', marginTop: 8 },
  logo: {
    fontSize: 50,
    fontWeight: FontWeight.bold,
    color: Colors.teal,
    letterSpacing: 5,
    fontFamily: 'Georgia',
  },
  tagline: {
    fontSize: 20,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    textAlign: 'center',
    fontFamily: 'Georgia',
  },
  landingActions: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  form: {
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.xxl,
  },
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
    paddingVertical: 18,
    color: Colors.textPrimary,
    fontSize: 17,
    fontFamily: 'Georgia',
  },
  btn: {
    backgroundColor: Colors.teal,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    width: '76%',
    alignItems: 'center',
    alignSelf: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    color: '#1A1404',
    fontSize: 19,
    fontWeight: FontWeight.bold,
    fontFamily: 'Georgia',
    letterSpacing: 1,
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
    fontSize: 16,
    textAlign: 'center',
    marginTop: 3,
    fontFamily: 'Georgia',
    textDecorationLine: 'underline',
  },
  backLink: {
    color: Colors.teal,
    textAlign: 'center',
    fontFamily: 'Georgia',
    fontSize: 15,
    marginTop: 6,
  },
})
