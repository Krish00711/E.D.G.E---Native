import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, Switch
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../../store/authStore'
import EdgeBackdrop from '../../../components/EdgeBackdrop'
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../../constants/theme'

export default function ProfileScreen() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [notifEnabled, setNotifEnabled] = useState(true)
  const [anomalyAlerts, setAnomalyAlerts] = useState(true)

  async function handleLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/login')
        }
      }
    ])
  }

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <View style={styles.container}>
      <EdgeBackdrop />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      {/* Account info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <InfoRow icon="person-outline" label="Name" value={user?.name ?? '—'} />
        <InfoRow icon="mail-outline" label="Email" value={user?.email ?? '—'} />
        <InfoRow icon="shield-checkmark-outline" label="Role" value={user?.role ?? '—'} />
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <ToggleRow
          icon="notifications-outline"
          label="Push notifications"
          value={notifEnabled}
          onToggle={setNotifEnabled}
        />
        <ToggleRow
          icon="warning-outline"
          label="Anomaly alerts"
          value={anomalyAlerts}
          onToggle={setAnomalyAlerts}
        />
      </View>

      {/* Navigation links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>More</Text>
        <NavRow icon="people-outline" label="Peer Pulse" onPress={() => router.push('/(app)/(student)/peerpulse')} />
        <NavRow icon="flask-outline" label="What-If Simulator" onPress={() => router.push('/(app)/(student)/whatif')} />
        <NavRow icon="heart-outline" label="Recovery" onPress={() => router.push('/(app)/(student)/recovery')} />
        <NavRow icon="library-outline" label="Resources" onPress={() => router.push('/(app)/(student)/resources')} />
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color={Colors.error} />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={18} color={Colors.textMuted} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

function ToggleRow({ icon, label, value, onToggle }: { icon: string; label: string; value: boolean; onToggle: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={18} color={Colors.textMuted} />
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.border, true: Colors.teal + '66' }}
        thumbColor={value ? Colors.teal : Colors.textMuted}
      />
    </View>
  )
}

function NavRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Ionicons name={icon as any} size={18} color={Colors.textMuted} />
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingTop: 60, paddingBottom: Spacing.xl },
  avatar: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: Colors.teal + '22', alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarText: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.teal },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  email: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },
  roleBadge: {
    marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 4,
    backgroundColor: Colors.teal + '22', borderRadius: Radius.full,
  },
  roleText: { fontSize: FontSize.xs, color: Colors.teal, fontWeight: FontWeight.semibold },
  section: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: '#131313DE', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    marginBottom: 2,
  },
  rowLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  rowValue: { fontSize: FontSize.sm, color: Colors.textPrimary, marginLeft: 'auto' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.error + '44',
  },
  logoutText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
})
