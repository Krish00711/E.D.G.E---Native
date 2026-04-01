import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, TextInput
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { RiskDonut } from '../../../components/EdgeCharts'
import { Colors, Spacing, Radius, FontSize, FontWeight, riskColor } from '../../../constants/theme'

interface StudentSummary {
  _id: string
  userId?: { name: string; email: string }
  name?: string
  email?: string
  latestPrediction?: {
    riskLevel: string
    riskScore: number
    createdAt: string
  }
}

export default function MentorDashboard() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [filtered, setFiltered] = useState<StudentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'moderate' | 'low'>('all')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/students', { params: { limit: 100 } })
      const data: StudentSummary[] = Array.isArray(res.data) ? res.data : res.data?.students ?? []
      setStudents(data)
      setFiltered(data)
    } catch {
      // show empty state
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let result = students
    if (riskFilter !== 'all') {
      result = result.filter(s => (s.latestPrediction?.riskLevel ?? (s as any).riskLevel) === riskFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s => {
        const name = s.userId?.name ?? s.name ?? ''
        const email = s.userId?.email ?? s.email ?? ''
        return name.toLowerCase().includes(q) || email.toLowerCase().includes(q)
      })
    }
    setFiltered(result)
  }, [search, riskFilter, students])

  function onRefresh() { setRefreshing(true); load() }

  const highRisk = students.filter(s => (s.latestPrediction?.riskLevel ?? (s as any).riskLevel) === 'high').length
  const modRisk = students.filter(s => (s.latestPrediction?.riskLevel ?? (s as any).riskLevel) === 'moderate').length

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Mentor Control</Text>
          <Text style={styles.subtitle}>Mentor Dashboard</Text>
        </View>
        <TouchableOpacity onPress={async () => { await logout(); router.replace('/(auth)/login') }}>
          <Ionicons name="log-out-outline" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroKicker}>Active Cases</Text>
          <Text style={styles.heroValue}>{highRisk + modRisk}</Text>
          <Text style={styles.heroSub}>priority learners in your watchlist</Text>
        </View>
        <RiskDonut value={Math.min(1, (highRisk + modRisk) / Math.max(students.length || 1, 1))} size={74} color={Colors.amber} trackColor={Colors.border + '66'} />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard label="Total Students" value={students.length} color={Colors.teal} />
        <StatCard label="High Risk" value={highRisk} color={Colors.riskHigh} />
        <StatCard label="Moderate" value={modRisk} color={Colors.riskModerate} />
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search students..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Risk filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.lg }}>
        {(['all', 'high', 'moderate', 'low'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, riskFilter === f && styles.chipActive]}
            onPress={() => setRiskFilter(f)}
          >
            <Text style={[styles.chipText, riskFilter === f && styles.chipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Student list */}
      {loading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No students found</Text>
            </View>
          ) : (
            filtered.map(s => {
              const name = s.userId?.name ?? s.name ?? 'Unknown'
              const email = s.userId?.email ?? s.email ?? ''
              const risk = s.latestPrediction?.riskLevel ?? (s as any).riskLevel
              const score = s.latestPrediction?.riskScore ?? (s as any).currentRisk
              const color = riskColor(risk)
              return (
                <TouchableOpacity
                  key={s._id}
                  style={styles.studentCard}
                  onPress={() => router.push({ pathname: '/(app)/(mentor)/student-detail', params: { studentId: s._id } })}
                >
                  <View style={[styles.avatar, { backgroundColor: color + '22' }]}>
                    <Text style={[styles.avatarText, { color }]}>{name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{name}</Text>
                    <Text style={styles.studentEmail}>{email}</Text>
                  </View>
                  {risk ? (
                    <View style={[styles.riskBadge, { backgroundColor: color + '22' }]}>
                      <Text style={[styles.riskText, { color }]}>{risk.toUpperCase()}</Text>
                      {score !== undefined && (
                        <Text style={[styles.riskScore, { color }]}>{Math.round(score * 100)}%</Text>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.noRisk}>No data</Text>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )
            })
          )}
        </ScrollView>
      )}
    </View>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderColor: color + '44' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
  },
  greeting: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary, letterSpacing: 0.3 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1.1 },
  heroCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: '#131313DD',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLeft: { gap: 2 },
  heroKicker: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { fontSize: FontSize.xxl, color: Colors.amber, fontWeight: FontWeight.bold },
  heroSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  statCard: {
    flex: 1, backgroundColor: '#141414D9', borderRadius: Radius.md,
    borderWidth: 1, padding: Spacing.md, alignItems: 'center',
  },
  statValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: '#171717E8', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm },
  chips: { marginBottom: Spacing.sm, flexGrow: 0 },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: '#171717D9',
  },
  chipActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  chipText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTextActive: { color: Colors.background, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 32 },
  studentCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#141414DD', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  studentInfo: { flex: 1 },
  studentName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  studentEmail: { fontSize: FontSize.xs, color: Colors.textMuted },
  riskBadge: { borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, alignItems: 'center' },
  riskText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  riskScore: { fontSize: 10, marginTop: 1 },
  noRisk: { fontSize: FontSize.xs, color: Colors.textMuted },
  empty: { alignItems: 'center', gap: Spacing.md, paddingTop: 60 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.md },
})
