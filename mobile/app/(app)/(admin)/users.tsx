import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import api from '../../../lib/api'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

interface User {
  _id: string
  name: string
  email: string
  role: string
  isActive?: boolean
  createdAt: string
}

const ROLE_COLORS: Record<string, string> = {
  student: Colors.teal,
  mentor: Colors.amber,
  admin: Colors.cynicism,
}

export default function UsersScreen() {
  const [users, setUsers] = useState<User[]>([])
  const [filtered, setFiltered] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/users', { params: { limit: 100 } })
      const data: User[] = Array.isArray(res.data) ? res.data : res.data?.users ?? []
      setUsers(data)
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
    let result = users
    if (roleFilter !== 'all') result = result.filter(u => u.role === roleFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }
    setFiltered(result)
  }, [search, roleFilter, users])

  function onRefresh() { setRefreshing(true); load() }

  async function toggleActive(user: User) {
    try {
      await api.patch(`/admin/users/${user._id}`, { isActive: !user.isActive })
      load()
    } catch {
      Alert.alert('Error', 'Failed to update user')
    }
  }

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <View style={styles.header}>
        <Text style={styles.title}>User Management</Text>
        <Text style={styles.subtitle}>{users.length} users</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Role filter */}
      <View style={styles.chips}>
        {['all', 'student', 'mentor', 'admin'].map(r => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, roleFilter === r && styles.chipActive]}
            onPress={() => setRoleFilter(r)}
          >
            <Text style={[styles.chipText, roleFilter === r && styles.chipTextActive]}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={u => u._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const roleColor = ROLE_COLORS[item.role] ?? Colors.textMuted
            return (
              <View style={styles.userCard}>
                <View style={[styles.avatar, { backgroundColor: roleColor + '22' }]}>
                  <Text style={[styles.avatarText, { color: roleColor }]}>{item.name[0]?.toUpperCase()}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                  <Text style={styles.userDate}>Joined {new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
                <View style={styles.userRight}>
                  <View style={[styles.roleBadge, { backgroundColor: roleColor + '22' }]}>
                    <Text style={[styles.roleText, { color: roleColor }]}>{item.role}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.activeToggle, { borderColor: item.isActive !== false ? Colors.riskLow + '44' : Colors.error + '44' }]}
                    onPress={() => toggleActive(item)}
                  >
                    <Text style={[styles.activeText, { color: item.isActive !== false ? Colors.riskLow : Colors.error }]}>
                      {item.isActive !== false ? 'Active' : 'Inactive'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
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
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: '#141414E8', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm },
  chips: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: '#151515D8',
  },
  chipActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  chipText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  chipTextActive: { color: Colors.background, fontWeight: FontWeight.semibold },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 32 },
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#121212E6', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  userInfo: { flex: 1 },
  userName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  userEmail: { fontSize: FontSize.xs, color: Colors.textMuted },
  userDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  userRight: { alignItems: 'flex-end', gap: 4 },
  roleBadge: { borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  roleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },
  activeToggle: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  activeText: { fontSize: FontSize.xs },
  empty: { alignItems: 'center', gap: Spacing.md, paddingTop: 60 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.md },
})
