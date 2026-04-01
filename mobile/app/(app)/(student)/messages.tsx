import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

export default function MessagesScreen() {
  const { user } = useAuthStore()
  const [conversations, setConversations] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get('/communications/inbox')
      setConversations(res.data?.messages || res.data || [])
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  async function loadMessages(conv: any) {
    setSelected(conv)
    try {
      const res = await api.get(`/communications/${conv._id}/thread`)
      setMessages(res.data?.replies || [])
    } catch {}
  }

  async function send() {
    if (!text.trim() || !selected) return
    setSending(true)
    try {
      await api.post('/communications', {
        toUserId: selected.toUserId || selected.fromUserId || selected._id,
        subject: 'Message',
        message: text.trim(),
        type: 'message',
      })
      setMessages((prev) => [...prev, { senderId: user?.id, message: text.trim(), createdAt: new Date().toISOString() }])
      setText('')
    } catch {}
    finally { setSending(false) }
  }

  if (selected) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <EdgeBackdrop />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelected(null)}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selected.recipientName || 'Conversation'}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.msgList}>
          {messages.map((m, i) => {
            const isMine = m.senderId === user?.id
            return (
              <View key={i} style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{m.message || m.content}</Text>
                <Text style={styles.bubbleTime}>{m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
              </View>
            )
          })}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <TouchableOpacity style={[styles.sendBtn, sending && styles.btnDisabled]} onPress={send} disabled={sending}>
            <Ionicons name="send" size={18} color={Colors.background} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>
      {loading ? <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={styles.content}>
          {conversations.length === 0 && <Text style={styles.empty}>No messages yet</Text>}
          {conversations.map((c, i) => (
            <TouchableOpacity key={c._id || i} style={styles.convCard} onPress={() => loadMessages(c)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(c.recipientName || 'M')[0].toUpperCase()}</Text>
              </View>
              <View style={styles.convContent}>
                <Text style={styles.convName}>{c.recipientName || 'Mentor'}</Text>
                <Text style={styles.convLast} numberOfLines={1}>{c.lastMessage || 'No messages yet'}</Text>
              </View>
              <Text style={styles.convTime}>{c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : ''}</Text>
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
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  content: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.sm },
  convCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#131313E3', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.teal + '33', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.teal, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  convContent: { flex: 1 },
  convName: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  convLast: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  convTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  msgList: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  bubble: {
    maxWidth: '80%', padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: '#151515EA', borderWidth: 1, borderColor: Colors.border,
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: Colors.teal + '22', borderColor: Colors.teal + '44' },
  bubbleOther: { alignSelf: 'flex-start' },
  bubbleText: { fontSize: FontSize.md, color: Colors.textPrimary },
  bubbleTextMine: { color: Colors.textPrimary },
  bubbleTime: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4, textAlign: 'right' },
  inputRow: {
    flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background,
  },
  input: {
    flex: 1, backgroundColor: '#161616E6', borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.sm, color: Colors.textPrimary,
    fontSize: FontSize.md, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.teal, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
})
