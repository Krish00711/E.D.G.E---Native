import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import { useAuthStore } from '../../../store/authStore'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

interface Conversation {
  _id: string
  participants: Array<{ _id: string; name: string; email: string }>
  lastMessage?: { content: string; createdAt: string }
  unreadCount?: number
  toUserId?: string
  fromUserId?: string
  subject?: string
}

interface Message {
  _id: string
  senderId: string
  content: string
  createdAt: string
}

export default function MentorMessagesScreen() {
  const { user } = useAuthStore()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const flatRef = useRef<FlatList>(null)

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get('/communications/inbox')
      const data = Array.isArray(res.data) ? res.data : res.data?.messages ?? []
      // Map inbox messages to conversation-like objects
      const convs = data.map((m: any) => ({
        _id: m._id,
        participants: [
          { _id: m.fromUserId?._id ?? m.fromUserId, name: m.fromUserId?.name ?? 'Unknown', email: m.fromUserId?.email ?? '' },
        ],
        toUserId: m.toUserId?._id ?? m.toUserId,
        fromUserId: m.fromUserId?._id ?? m.fromUserId,
        lastMessage: { content: m.message, createdAt: m.createdAt },
        subject: m.subject,
      }))
      setConversations(convs)
    } catch {
      // show empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  async function openConversation(conv: Conversation) {
    setActiveConv(conv)
    try {
      const res = await api.get(`/communications/${conv._id}/thread`)
      const original = res.data?.original
      const replies = res.data?.replies ?? []
      const all = original ? [original, ...replies] : replies
      const mapped = all.map((m: any) => ({
        _id: m._id,
        senderId: m.fromUserId?._id ?? m.fromUserId,
        content: m.message,
        createdAt: m.createdAt,
      }))
      setMessages(mapped)
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100)
    } catch {}
  }

  async function sendMessage() {
    if (!text.trim() || !activeConv) return
    setSending(true)
    try {
      const recipientId = activeConv.fromUserId !== user?.id
        ? activeConv.fromUserId
        : activeConv.toUserId
      const res = await api.post('/communications', {
        toUserId: recipientId,
        subject: 'Re: ' + (activeConv.subject || 'Message'),
        message: text.trim(),
        type: 'message',
        parentId: activeConv._id,
      })
      setMessages(prev => [...prev, {
        _id: res.data?.communication?._id ?? String(Date.now()),
        senderId: user?.id ?? '',
        content: text.trim(),
        createdAt: new Date().toISOString(),
      }])
      setText('')
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  // Chat view
  if (activeConv) {
    const other = activeConv.participants.find(p => p._id !== user?.id)
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <EdgeBackdrop />
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setActiveConv(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.chatAvatar}>
            <Text style={styles.chatAvatarText}>{other?.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View>
            <Text style={styles.chatName}>{other?.name ?? 'Student'}</Text>
            <Text style={styles.chatRole}>Student</Text>
          </View>
        </View>

        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m._id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const isMine = item.senderId === user?.id
            return (
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
                <Text style={styles.bubbleTime}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            )
          }}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={sending || !text.trim()}>
            {sending ? <ActivityIndicator color={Colors.background} size="small" /> : <Ionicons name="send" size={18} color={Colors.background} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  // Conversation list
  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No conversations yet</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c._id}
          contentContainerStyle={styles.convList}
          renderItem={({ item }) => {
            const other = item.participants.find(p => p._id !== user?.id)
            return (
              <TouchableOpacity style={styles.convCard} onPress={() => openConversation(item)}>
                <View style={styles.convAvatar}>
                  <Text style={styles.convAvatarText}>{other?.name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={styles.convInfo}>
                  <Text style={styles.convName}>{other?.name ?? 'Student'}</Text>
                  <Text style={styles.convLast} numberOfLines={1}>
                    {item.lastMessage?.content ?? 'No messages yet'}
                  </Text>
                </View>
                {item.lastMessage && (
                  <Text style={styles.convTime}>
                    {new Date(item.lastMessage.createdAt).toLocaleDateString()}
                  </Text>
                )}
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  convList: { padding: Spacing.lg, gap: Spacing.sm },
  convCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#131313E0', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  convAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.teal + '22', alignItems: 'center', justifyContent: 'center',
  },
  convAvatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.teal },
  convInfo: { flex: 1 },
  convName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  convLast: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  convTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: '#0B0B0BCF',
  },
  backBtn: { padding: 4 },
  chatAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.teal + '22', alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.teal },
  chatName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  chatRole: { fontSize: FontSize.xs, color: Colors.textMuted },
  messageList: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 16 },
  bubble: {
    maxWidth: '75%', borderRadius: Radius.md, padding: Spacing.sm,
    backgroundColor: '#191919EF', alignSelf: 'flex-start',
  },
  bubbleOther: {
    backgroundColor: Colors.surface, alignSelf: 'flex-start',
  },
  bubbleMine: { backgroundColor: Colors.teal, alignSelf: 'flex-end' },
  bubbleText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 18 },
  bubbleTextMine: { color: Colors.background },
  bubbleTime: { fontSize: 10, color: Colors.textMuted, marginTop: 2, textAlign: 'right' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, backgroundColor: '#171717EE', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.textPrimary, fontSize: FontSize.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 10, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.teal, alignItems: 'center', justifyContent: 'center',
  },
  empty: { alignItems: 'center', gap: Spacing.md, paddingTop: 60 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.md },
})
