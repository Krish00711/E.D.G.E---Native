import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

export default function ForumsScreen() {
  const { user } = useAuthStore()
  const [forums, setForums] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [posting, setPosting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/forums')
      setForums(res.data?.forums || res.data || [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function postReply() {
    if (!reply.trim() || !selected) return
    setPosting(true)
    try {
      await api.post(`/forums/${selected._id}/posts`, { content: reply.trim() })
      setReply('')
      const res = await api.get(`/forums/${selected._id}`)
      setSelected(res.data)
    } catch {
      Alert.alert('Error', 'Could not post reply')
    } finally { setPosting(false) }
  }

  if (selected) {
    return (
      <View style={styles.container}>
        <EdgeBackdrop />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelected(null)}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{selected.title}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {(selected.posts || []).map((p: any, i: number) => (
            <View key={i} style={styles.postCard}>
              <View style={styles.postHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(p.userId?.name || p.authorName || 'U')[0].toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.postAuthor}>{p.userId?.name || p.authorName || 'Anonymous'}</Text>
                  <Text style={styles.postTime}>{p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}</Text>
                </View>
              </View>
              <Text style={styles.postContent}>{p.content}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.replyRow}>
          <TextInput
            style={styles.replyInput}
            value={reply}
            onChangeText={setReply}
            placeholder="Write a reply..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <TouchableOpacity style={[styles.sendBtn, posting && styles.btnDisabled]} onPress={postReply} disabled={posting}>
            <Ionicons name="send" size={18} color={Colors.background} />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>Forums</Text>
      </View>
      {loading ? <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} /> : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={Colors.teal} />}
        >
          {forums.length === 0 && <Text style={styles.empty}>No forums yet</Text>}
          {forums.map((f, i) => (
            <TouchableOpacity key={f._id || i} style={styles.forumCard} onPress={() => setSelected(f)}>
              <View style={styles.forumIcon}>
                <Ionicons name="chatbubbles-outline" size={20} color={Colors.teal} />
              </View>
              <View style={styles.forumContent}>
                <Text style={styles.forumTitle}>{f.title}</Text>
                <Text style={styles.forumMeta}>{f.posts?.length || 0} posts</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, paddingTop: 56 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  headerTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  content: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.sm },
  forumCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#131313E2', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  forumIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.teal + '22', alignItems: 'center', justifyContent: 'center',
  },
  forumContent: { flex: 1 },
  forumTitle: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  forumMeta: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  postCard: {
    backgroundColor: '#141414E8', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.teal + '33', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.teal, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  postAuthor: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  postTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  postContent: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 22 },
  replyRow: {
    flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  replyInput: {
    flex: 1, backgroundColor: '#171717E8', borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.sm, color: Colors.textPrimary, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.teal, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
})
