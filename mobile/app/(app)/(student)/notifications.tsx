import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data?.notifications || res.data || [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function markRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n))
    } catch {}
  }

  const iconForType = (type: string) => {
    if (type === 'alert') return 'warning'
    if (type === 'intervention') return 'medkit'
    if (type === 'reminder') return 'alarm'
    return 'notifications'
  }

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
      </View>
      {loading ? <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} /> : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={Colors.teal} />}
        >
          {notifications.length === 0 && <Text style={styles.empty}>No notifications</Text>}
          {notifications.map((n, i) => (
            <TouchableOpacity key={n._id || i} style={[styles.card, !n.isRead && styles.cardUnread]} onPress={() => markRead(n._id)}>
              <Ionicons name={iconForType(n.type) as any} size={20} color={n.isRead ? Colors.textMuted : Colors.teal} />
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, !n.isRead && styles.cardTitleUnread]}>{n.title || n.message || 'Notification'}</Text>
                {n.body && <Text style={styles.cardBody}>{n.body}</Text>}
                <Text style={styles.cardTime}>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</Text>
              </View>
              {!n.isRead && <View style={styles.dot} />}
            </TouchableOpacity>
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
  content: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.sm },
  card: {
    flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
    backgroundColor: '#131313E3', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  cardUnread: { borderColor: Colors.teal + '44' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  cardTitleUnread: { color: Colors.textPrimary },
  cardBody: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  cardTime: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.teal, marginTop: 4 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
})
