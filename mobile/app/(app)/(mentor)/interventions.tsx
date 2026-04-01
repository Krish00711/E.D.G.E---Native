import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

interface InterventionNote {
  _id?: string
  author?: string
  text?: string
  createdAt?: string
}

interface Intervention {
  _id: string
  studentId?: { name?: string; userId?: { name: string } }
  type: string
  title?: string
  description?: string
  notes?: InterventionNote[] | string
  status: string
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.amber,
  active: Colors.teal,
  completed: Colors.riskLow,
  cancelled: Colors.textMuted,
}

export default function InterventionsScreen() {
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/interventions', { params: { limit: 50 } })
      const data = Array.isArray(res.data) ? res.data : res.data?.interventions ?? []
      setInterventions(data)
    } catch {
      // show empty state
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function onRefresh() { setRefreshing(true); load() }

  const filtered = statusFilter === 'all'
    ? interventions
    : interventions.filter(i => i.status === statusFilter)

  async function updateStatus(id: string, status: string) {
    try {
      await api.patch(`/interventions/${id}`, { status })
      load()
    } catch {}
  }

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>Interventions</Text>
        <Text style={styles.subtitle}>{interventions.length} total</Text>
      </View>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.lg }}>
        {['all', 'planned', 'in-progress', 'completed'].map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, statusFilter === s && styles.chipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="medkit-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No interventions</Text>
            </View>
          ) : (
            filtered.map(iv => {
              const statusColor = STATUS_COLORS[iv.status] ?? Colors.textMuted
              const studentName = iv.studentId?.userId?.name ?? 'Unknown Student'
              return (
                <View key={iv._id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.cardType}>{iv.type.replace('_', ' ')}</Text>
                      <Text style={styles.cardStudent}>{studentName}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>{iv.status}</Text>
                    </View>
                  </View>

                  {/* description or latest note */}
                  {iv.description ? (
                    <Text style={styles.notes}>{iv.description}</Text>
                  ) : Array.isArray(iv.notes) && iv.notes.length > 0 ? (
                    <Text style={styles.notes}>{iv.notes[iv.notes.length - 1]?.text ?? ''}</Text>
                  ) : typeof iv.notes === 'string' && iv.notes ? (
                    <Text style={styles.notes}>{iv.notes}</Text>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <Text style={styles.date}>{new Date(iv.createdAt).toLocaleDateString()}</Text>
                    {iv.status === 'planned' && (
                      <View style={styles.actions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => updateStatus(iv._id, 'in-progress')}>
                          <Text style={styles.actionBtnText}>Activate</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.completeBtn]} onPress={() => updateStatus(iv._id, 'completed')}>
                          <Text style={[styles.actionBtnText, { color: Colors.riskLow }]}>Complete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {iv.status === 'in-progress' && (
                      <TouchableOpacity style={[styles.actionBtn, styles.completeBtn]} onPress={() => updateStatus(iv._id, 'completed')}>
                        <Text style={[styles.actionBtnText, { color: Colors.riskLow }]}>Mark Complete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )
            })
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  chips: { marginBottom: Spacing.sm, flexGrow: 0 },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: '#161616DA',
  },
  chipActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  chipText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTextActive: { color: Colors.background, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 32 },
  card: {
    backgroundColor: '#121212E2', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1 },
  cardType: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary, textTransform: 'capitalize' },
  cardStudent: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  notes: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: FontSize.xs, color: Colors.textMuted },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#1E1E1ECC',
  },
  completeBtn: { borderColor: Colors.riskLow + '44' },
  actionBtnText: { fontSize: FontSize.xs, color: Colors.teal },
  empty: { alignItems: 'center', gap: Spacing.md, paddingTop: 60 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.md },
})
