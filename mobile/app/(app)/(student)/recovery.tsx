import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

export default function RecoveryScreen() {
  const { user } = useAuthStore()
  const [actions, setActions] = useState<any[]>([])
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [personalized, setPersonalized] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const studentId = user?.studentId
      const [persRes, recRes, actRes] = await Promise.allSettled([
        api.post('/recovery/personalized', { studentId }),
        api.get('/recommendations', { params: { studentId } }),
        api.get('/recovery/actions', { params: { studentId } }),
      ])
      if (persRes.status === 'fulfilled') {
        const d = persRes.value.data
        setPersonalized(Array.isArray(d?.recommendations) ? d.recommendations : [])
      }
      if (recRes.status === 'fulfilled') {
        const d = recRes.value.data
        setRecommendations(Array.isArray(d) ? d : d?.recommendations ?? [])
      }
      if (actRes.status === 'fulfilled') {
        const d = actRes.value.data
        setActions(Array.isArray(d) ? d : d?.actions ?? [])
      }
    } catch {}
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.studentId])

  useEffect(() => { load() }, [load])

  async function markComplete(actionId: string) {
    try {
      await api.patch(`/recovery/session-actions/${actionId}`, { status: 'taken' })
      setActions((prev) => prev.map((a) => a._id === actionId ? { ...a, status: 'completed' } : a))
    } catch {
      Alert.alert('Error', 'Could not update action')
    }
  }

  const completedCount = actions.filter((a) => a.status === 'completed').length
  const streak = completedCount // simplified streak

  function categoryIcon(category: string) {
    switch (category) {
      case 'sleep': return 'moon'
      case 'stress': return 'leaf'
      case 'social': return 'people'
      case 'academic': return 'book'
      case 'physical': return 'fitness'
      case 'mental': return 'heart'
      default: return 'bulb-outline'
    }
  }

  function priorityColor(priority: string) {
    if (priority === 'high') return Colors.riskHigh
    if (priority === 'medium') return Colors.amber
    return Colors.riskLow
  }

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>Recovery</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={Colors.teal} />}
        >
          {/* Personalized recommendations */}
          {personalized.length > 0 && (
            <>
              <View style={styles.personalizedHeader}>
                <Ionicons name="sparkles" size={18} color={Colors.teal} />
                <Text style={styles.sectionTitle}>Personalized for You</Text>
              </View>
              {personalized.map((p, i) => (
                <View key={p._id || p.title || i} style={styles.personalizedCard}>
                  <View style={styles.personalizedTop}>
                    <View style={styles.personalizedLeft}>
                      <Ionicons name={categoryIcon(p.category) as any} size={18} color={Colors.teal} />
                      <Text style={styles.personalizedTitle}>{p.title || 'Recommendation'}</Text>
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: priorityColor(p.priority) + '22' }]}>
                      <Text style={[styles.priorityText, { color: priorityColor(p.priority) }]}>
                        {String(p.priority || 'low').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {p.description ? <Text style={styles.personalizedDesc}>{p.description}</Text> : null}
                  <View style={styles.personalizedMeta}>
                    {p.source === 'ai' && (
                      <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>AI Personalized</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Streak card */}
          <View style={styles.streakCard}>
            <Ionicons name="flame" size={32} color={Colors.amber} />
            <View>
              <Text style={styles.streakValue}>{streak} actions</Text>
              <Text style={styles.streakLabel}>completed this week</Text>
            </View>
          </View>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recommended for You</Text>
              {recommendations.slice(0, 5).map((r, i) => (
                <View key={r._id || i} style={styles.recCard}>
                  <Ionicons name="bulb-outline" size={18} color={Colors.teal} />
                  <View style={styles.recContent}>
                    <Text style={styles.recTitle}>{r.title || r.type || 'Recommendation'}</Text>
                    {r.description && <Text style={styles.recDesc}>{r.description}</Text>}
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Recovery actions */}
          <Text style={styles.sectionTitle}>Recovery Actions</Text>
          {actions.length === 0 && (
            <Text style={styles.empty}>No recovery actions yet. Your mentor will add some.</Text>
          )}
          {actions.map((a, i) => (
            <View key={a._id || i} style={[styles.actionCard, a.status === 'completed' && styles.actionCardDone]}>
              <TouchableOpacity
                style={[styles.checkbox, a.status === 'completed' && styles.checkboxDone]}
                onPress={() => a.status !== 'completed' && markComplete(a._id)}
              >
                {a.status === 'completed' && <Ionicons name="checkmark" size={14} color={Colors.background} />}
              </TouchableOpacity>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, a.status === 'completed' && styles.actionTitleDone]}>
                  {a.title || a.action || 'Action'}
                </Text>
                {a.description && <Text style={styles.actionDesc}>{a.description}</Text>}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, paddingTop: 56 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  content: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.md },
  personalizedHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  personalizedCard: {
    backgroundColor: '#121212E5', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  personalizedTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  personalizedLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  personalizedTitle: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  personalizedDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  personalizedMeta: { flexDirection: 'row', alignItems: 'center' },
  priorityBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  priorityText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  aiBadge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: Colors.teal + '22',
    borderWidth: 1,
    borderColor: Colors.teal + '66',
  },
  aiBadgeText: { fontSize: FontSize.xs, color: Colors.teal, fontWeight: FontWeight.semibold },
  streakCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#121212E5', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.amber + '44', padding: Spacing.lg,
  },
  streakValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.amber },
  streakLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: Spacing.sm },
  recCard: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: '#131313DE', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  recContent: { flex: 1 },
  recTitle: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  recDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  actionCard: {
    flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
    backgroundColor: '#131313DE', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  actionCardDone: { opacity: 0.6 },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.teal,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  actionTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  actionDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md },
})
