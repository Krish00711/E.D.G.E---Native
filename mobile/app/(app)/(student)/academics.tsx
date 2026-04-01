import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native'
import api from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Sparkline } from '../../../components/EdgeCharts'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

type AcademicsTab = 'grades' | 'assignments' | 'attendance'

// Safely extract an array from any API response shape
function toArr(data: any, ...keys: string[]): any[] {
  if (Array.isArray(data)) return data
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k]
  }
  return []
}

function courseLabel(courseId: any): string {
  if (!courseId) return ''
  if (typeof courseId === 'object') return courseId.code || courseId.title || courseId._id || ''
  return String(courseId)
}

export default function AcademicsScreen() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<AcademicsTab>('grades')
  const [grades, setGrades] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const studentId = user?.studentId
    if (!studentId) {
      setGrades([])
      setAssignments([])
      setAttendance([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    // Load grades with fallback
    try {
      const gRes = await api.get('/grades', { params: { studentId } })
      setGrades(toArr(gRes.data, 'grades', 'data'))
    } catch (err: any) {
      if (err?.response?.status === 401) {
        // Try alternate endpoint
        try {
          await api.get(`/grades/student/${studentId}/gpa`)
          setGrades([])
        } catch {
          setGrades([])
        }
      } else {
        setGrades([])
      }
    }

    // Load assignments
    try {
      const aRes = await api.get('/assignments', { params: { studentId } })
      setAssignments(toArr(aRes.data, 'assignments', 'data'))
    } catch (err: any) {
      setAssignments([])
    }

    // Load attendance
    try {
      const atRes = await api.get('/attendance', { params: { studentId } })
      setAttendance(toArr(atRes.data, 'attendance', 'records', 'data'))
    } catch (err: any) {
      setAttendance([])
    }

    setLoading(false)
    setRefreshing(false)
  }, [user?.studentId])

  useEffect(() => { load() }, [load])

  const attendanceRate = attendance.length > 0
    ? Math.round((attendance.filter((a) => a.status === 'present' || a.status === 'late').length / attendance.length) * 100)
    : null

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>Academics</Text>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Momentum</Text>
        <Sparkline values={[0.58, 0.62, 0.59, 0.67, 0.71, 0.69, 0.74]} color={Colors.amber} width={180} height={40} />
      </View>

      <View style={styles.tabs}>
        {(['grades', 'assignments', 'attendance'] as AcademicsTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={Colors.teal} />}
        >
          {tab === 'grades' && (
            <View style={styles.list}>
              {grades.length === 0 && <Text style={styles.empty}>No grades yet</Text>}
              {grades.map((g, i) => (
                <View key={g._id || i} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardTitle}>{g.title || g.gradeType || 'Grade'}</Text>
                    <Text style={[styles.cardScore, { color: (g.score / g.maxScore) > 0.7 ? Colors.success : Colors.warning }]}>
                      {g.score}/{g.maxScore}
                    </Text>
                  </View>
                  {courseLabel(g.courseId) ? (
                    <Text style={styles.cardSub}>Course: {courseLabel(g.courseId)}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {tab === 'assignments' && (
            <View style={styles.list}>
              {assignments.length === 0 && <Text style={styles.empty}>No assignments</Text>}
              {assignments.map((a, i) => (
                <View key={a._id || i} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardTitle}>{a.title || 'Assignment'}</Text>
                    <View style={[styles.badge, {
                      backgroundColor: a.status === 'submitted' ? Colors.success + '22'
                        : a.status === 'missing' ? Colors.error + '22' : Colors.warning + '22'
                    }]}>
                      <Text style={[styles.badgeText, {
                        color: a.status === 'submitted' ? Colors.success
                          : a.status === 'missing' ? Colors.error : Colors.warning
                      }]}>{a.status || 'pending'}</Text>
                    </View>
                  </View>
                  {a.dueDate && <Text style={styles.cardSub}>Due: {new Date(a.dueDate).toLocaleDateString()}</Text>}
                </View>
              ))}
            </View>
          )}

          {tab === 'attendance' && (
            <View style={styles.list}>
              {attendanceRate !== null && (
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Attendance Rate</Text>
                  <Text style={[styles.statValue, { color: attendanceRate >= 75 ? Colors.success : Colors.error }]}>
                    {attendanceRate}%
                  </Text>
                </View>
              )}
              {attendance.length === 0 && <Text style={styles.empty}>No attendance records</Text>}
              {attendance.slice(0, 30).map((a, i) => (
                <View key={a._id || i} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardTitle}>{courseLabel(a.courseId) || 'Class'}</Text>
                    <View style={[styles.badge, {
                      backgroundColor: a.status === 'present' ? Colors.success + '22'
                        : a.status === 'absent' ? Colors.error + '22' : Colors.warning + '22'
                    }]}>
                      <Text style={[styles.badgeText, {
                        color: a.status === 'present' ? Colors.success
                          : a.status === 'absent' ? Colors.error : Colors.warning
                      }]}>{a.status}</Text>
                    </View>
                  </View>
                  {a.date && <Text style={styles.cardSub}>{new Date(a.date).toLocaleDateString()}</Text>}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, paddingTop: 56 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  heroCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: '#121212E3',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  tab: {
    flex: 1, padding: Spacing.sm, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  tabActive: { borderColor: Colors.teal, backgroundColor: Colors.teal + '1A' },
  tabText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  tabTextActive: { color: Colors.teal, fontWeight: FontWeight.semibold },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  list: { gap: Spacing.sm },
  card: {
    backgroundColor: '#121212E5', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium, flex: 1 },
  cardScore: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  cardSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  statCard: {
    backgroundColor: '#121212E5', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg,
    alignItems: 'center', marginBottom: Spacing.md,
  },
  statLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  statValue: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, marginTop: 4 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
})
