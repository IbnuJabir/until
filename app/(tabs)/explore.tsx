import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useReminderStore } from '@/app/src/store/reminderStore';
import { WarmColors, Elevation, Spacing, BorderRadius, Typography } from '@/constants/theme';

export default function ExploreScreen() {
  const router = useRouter();
  const { reminders, savedPlaces, entitlements } = useReminderStore();
  const activeReminders = reminders.filter((r) => r.status === 'waiting');
  const firedReminders = reminders.filter((r) => r.status === 'fired');

  const quickActions = [
    {
      id: 'voice',
      title: 'Voice Reminder',
      description: 'Create a reminder by speaking',
      icon: 'mic' as keyof typeof MaterialIcons.glyphMap,
      color: WarmColors.secondary,
      onPress: () => router.push('/voice-reminder' as any),
    },
    {
      id: 'location',
      title: 'Saved Places',
      description: `${savedPlaces.length} location${savedPlaces.length !== 1 ? 's' : ''} saved`,
      icon: 'location-on' as keyof typeof MaterialIcons.glyphMap,
      color: WarmColors.primary,
      onPress: () => {
        // Could navigate to a saved places management screen
      },
    },
    {
      id: 'stats',
      title: 'Statistics',
      description: `${firedReminders.length} completed reminders`,
      icon: 'bar-chart' as keyof typeof MaterialIcons.glyphMap,
      color: WarmColors.accent,
      onPress: () => {
        // Could navigate to stats screen
      },
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
        <Text style={styles.headerSubtitle}>Quick actions and insights</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: `${WarmColors.primary}15` }]}>
              <MaterialIcons name="notifications-active" size={24} color={WarmColors.primary} />
            </View>
            <Text style={styles.statValue}>{activeReminders.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: `${WarmColors.success}15` }]}>
              <MaterialIcons name="check-circle" size={24} color={WarmColors.success} />
            </View>
            <Text style={styles.statValue}>{firedReminders.length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: `${WarmColors.accent}15` }]}>
              <MaterialIcons name="location-on" size={24} color={WarmColors.accent} />
            </View>
            <Text style={styles.statValue}>{savedPlaces.length}</Text>
            <Text style={styles.statLabel}>Places</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionCard}
              onPress={action.onPress}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: `${action.color}15` }]}>
                <MaterialIcons name={action.icon} size={24} color={action.color} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={WarmColors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Pro Badge */}
        {!entitlements.hasProAccess && (
          <TouchableOpacity
            style={styles.proCard}
            onPress={() => router.push('/paywall' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.proIconContainer}>
              <MaterialIcons name="star" size={32} color={WarmColors.accent} />
            </View>
            <View style={styles.proContent}>
              <Text style={styles.proTitle}>Unlock Until Pro</Text>
              <Text style={styles.proDescription}>
                Get unlimited reminders and all context triggers
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={24} color={WarmColors.textOnPrimary} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WarmColors.backgroundLight,
  },
  header: {
    backgroundColor: WarmColors.background,
    paddingTop: 60,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: WarmColors.border,
    ...Elevation.level1,
  },
  headerTitle: {
    ...Typography.h2,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: WarmColors.textSecondary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: WarmColors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Elevation.level2,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    ...Typography.h3,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    ...Typography.caption,
    color: WarmColors.textSecondary,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.md,
  },
  actionCard: {
    backgroundColor: WarmColors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...Elevation.level2,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    ...Typography.bodyBold,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  actionDescription: {
    ...Typography.caption,
    color: WarmColors.textSecondary,
  },
  proCard: {
    backgroundColor: WarmColors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Elevation.level3,
  },
  proIconContainer: {
    marginRight: Spacing.md,
  },
  proContent: {
    flex: 1,
  },
  proTitle: {
    ...Typography.h4,
    color: WarmColors.textOnPrimary,
    marginBottom: Spacing.xs,
  },
  proDescription: {
    ...Typography.caption,
    color: WarmColors.textOnPrimary,
    opacity: 0.9,
  },
});
