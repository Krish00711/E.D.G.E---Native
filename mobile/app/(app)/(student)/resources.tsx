import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Linking, RefreshControl, TextInput
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

interface Resource {
  _id: string
  title: string
  description?: string
  type: string
  url?: string
  category?: string
  tags?: string[]
}

const TYPE_ICONS: Record<string, string> = {
  article: 'document-text',
  video: 'play-circle',
  tool: 'construct',
  exercise: 'fitness',
  contact: 'call',
  link: 'link',
}

export default function ResourcesScreen() {
  const [resources, setResources] = useState<Resource[]>([])
  const [filtered, setFiltered] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/resources')
      const data: Resource[] = Array.isArray(res.data) ? res.data : res.data?.resources ?? []
      setResources(data)
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
    let result = resources
    if (activeCategory !== 'All') {
      result = result.filter(r => (r.category ?? r.type) === activeCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.tags?.some(t => t.toLowerCase().includes(q))
      )
    }
    setFiltered(result)
  }, [search, activeCategory, resources])

  const categories = ['All', ...Array.from(new Set(resources.map(r => r.category ?? r.type).filter(Boolean)))]

  function onRefresh() {
    setRefreshing(true)
    load()
  }

  async function openResource(r: Resource) {
    if (r.url) {
      try { await Linking.openURL(r.url) } catch {}
    }
  }

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Resources</Text>
        <Text style={styles.subtitle}>Mental health & academic support</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search resources..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.lg }}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, activeCategory === cat && styles.chipActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="library-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No resources found</Text>
            </View>
          ) : (
            filtered.map(r => (
              <TouchableOpacity key={r._id} style={styles.card} onPress={() => openResource(r)} activeOpacity={0.8}>
                <View style={styles.cardIcon}>
                  <Ionicons name={(TYPE_ICONS[r.type] ?? 'document') as any} size={20} color={Colors.teal} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{r.title}</Text>
                  {r.description ? <Text style={styles.cardDesc} numberOfLines={2}>{r.description}</Text> : null}
                  <View style={styles.cardMeta}>
                    <Text style={styles.cardType}>{r.type}</Text>
                    {r.tags?.slice(0, 2).map(tag => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                {r.url ? <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} /> : null}
              </TouchableOpacity>
            ))
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
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: '#141414E7', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm },
  chips: { marginBottom: Spacing.sm, flexGrow: 0 },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: '#141414D8',
  },
  chipActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  chipText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTextActive: { color: Colors.background, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 32 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#121212E4', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: Radius.sm,
    backgroundColor: Colors.teal + '18', alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  cardDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  cardType: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'capitalize' },
  tag: { backgroundColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 10, color: Colors.textMuted },
  empty: { alignItems: 'center', gap: Spacing.md, paddingTop: 60 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.md },
})
