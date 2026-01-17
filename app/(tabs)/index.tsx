/**
 * Reminder List Screen (Home)
 * Displays all reminders grouped by status
 */

import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useReminderStore } from '@/app/src/store/reminderStore';
import { Reminder, ReminderStatus, TriggerType, isReminderActive } from '@/app/src/domain';
import { format } from 'date-fns';
import { Toast } from '@/app/src/utils/Toast';
import { WarmColors, Elevation, Spacing, BorderRadius, Typography } from '@/constants/theme';

export default function RemindersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ message?: string }>();
  const {
    reminders,
    deleteReminder,
    loadFromStorage,
    isLoading,
    entitlements,
    canAddMoreReminders,
  } = useReminderStore();

  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Load reminders on mount
  useEffect(() => {
    loadFromStorage();
  }, []);

  // Show toast if message param is present
  useEffect(() => {
    if (params.message) {
      setToastMessage(params.message);
      setShowToast(true);
    }
  }, [params.message]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFromStorage();
    setRefreshing(false);
  };

  const handleDeleteReminder = (id: string, title: string) => {
    Alert.alert(
      'Delete Reminder',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReminder(id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete reminder');
            }
          },
        },
      ]
    );
  };

  const handleCreateReminder = () => {
    if (!canAddMoreReminders()) {
      Alert.alert(
        'Upgrade Required',
        'Free tier allows up to 3 active reminders. Upgrade to create unlimited reminders!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/paywall' as any) },
        ]
      );
      return;
    }

    router.push('/create-reminder' as any);
  };

  const activeReminders = reminders.filter((r) => r.status === ReminderStatus.WAITING);
  const firedReminders = reminders.filter((r) => r.status === ReminderStatus.FIRED);

  const handleReminderPress = (id: string) => {
    router.push(`/reminder-detail?id=${id}` as any);
  };

  const getTriggerIcon = (type: TriggerType): keyof typeof MaterialIcons.glyphMap => {
    switch (type) {
      case TriggerType.PHONE_UNLOCK:
        return 'smartphone';
      case TriggerType.LOCATION_ENTER:
        return 'location-on';
      case TriggerType.CHARGING_STARTED:
        return 'battery-charging-full';
      case TriggerType.APP_OPENED:
        return 'apps';
      case TriggerType.SCHEDULED_TIME:
      case TriggerType.TIME_WINDOW:
        return 'schedule';
      default:
        return 'notifications';
    }
  };

  const renderReminderItem = ({ item }: { item: Reminder }) => {
    const isFired = item.status === ReminderStatus.FIRED;
    const primaryTrigger = item.triggers[0];
    const triggerIcon = primaryTrigger ? getTriggerIcon(primaryTrigger.type) : 'notifications';

    return (
      <TouchableOpacity
        style={[styles.reminderCard, isFired && styles.reminderCardFired]}
        onPress={() => handleReminderPress(item.id)}
        onLongPress={() => handleDeleteReminder(item.id, item.title)}
        activeOpacity={0.8}
      >
        <View style={styles.reminderContent}>
          <View style={[styles.reminderIconContainer, !isFired && styles.reminderIconContainerActive]}>
            <MaterialIcons 
              name={triggerIcon} 
              size={24} 
              color={isFired ? WarmColors.textTertiary : WarmColors.primary} 
            />
          </View>
          
          <View style={styles.reminderTextContainer}>
            <View style={styles.reminderHeader}>
              <Text style={[styles.reminderTitle, isFired && styles.textFired]} numberOfLines={2}>
                {item.title}
              </Text>
              {isFired && (
                <View style={styles.firedBadge}>
                  <MaterialIcons name="check-circle" size={14} color={WarmColors.success} />
                  <Text style={styles.firedBadgeText}>Fired</Text>
                </View>
              )}
            </View>

            {item.description && (
              <Text style={[styles.reminderDescription, isFired && styles.textFired]} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            <View style={styles.reminderMeta}>
              <View style={styles.metaItem}>
                <MaterialIcons name="notifications-active" size={14} color={WarmColors.textSecondary} />
                <Text style={[styles.metaText, isFired && styles.textFired]}>
                  {item.triggers.length} trigger{item.triggers.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <MaterialIcons name="calendar-today" size={14} color={WarmColors.textSecondary} />
                <Text style={[styles.metaText, isFired && styles.textFired]}>
                  {format(item.createdAt, 'MMM d')}
                </Text>
              </View>
            </View>

            {isFired && item.firedAt && (
              <View style={styles.firedAtContainer}>
                <MaterialIcons name="check-circle" size={12} color={WarmColors.success} />
                <Text style={styles.firedAtText}>
                  Fired {format(item.firedAt, 'MMM d, h:mm a')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <MaterialIcons name="notifications-none" size={64} color={WarmColors.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>No Reminders Yet</Text>
      <Text style={styles.emptyDescription}>
        Create your first context-aware reminder{'\n'}to get started
      </Text>
      <TouchableOpacity
        style={styles.emptyStateButton}
        onPress={handleCreateReminder}
        activeOpacity={0.8}
      >
        <MaterialIcons name="add" size={20} color={WarmColors.textOnPrimary} />
        <Text style={styles.emptyStateButtonText}>Create Reminder</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Until</Text>
          <View style={styles.headerSubtitleContainer}>
            <View style={[styles.proBadge, entitlements.hasProAccess && styles.proBadgeActive]}>
              <Text style={styles.proBadgeText}>
                {entitlements.hasProAccess ? 'Pro' : 'Free'}
              </Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {activeReminders.length} active
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.voiceButton}
          onPress={() => router.push('/voice-reminder' as any)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="mic" size={20} color={WarmColors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      {/* Reminder List */}
      <FlatList
        data={reminders}
        renderItem={renderReminderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={WarmColors.primary}
          />
        }
        ListHeaderComponent={
          reminders.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Your Reminders
              </Text>
              <Text style={styles.sectionSubtitle}>
                {activeReminders.length} active • {firedReminders.length} completed
              </Text>
            </View>
          ) : null
        }
      />

      {/* FAB - Floating Action Button */}
      {reminders.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleCreateReminder}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={28} color={WarmColors.textOnPrimary} />
        </TouchableOpacity>
      )}

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        visible={showToast}
        duration={2000}
        onHide={() => setShowToast(false)}
      />
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
    paddingHorizontal: Spacing.md,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Elevation.level1,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h2,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  headerSubtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: WarmColors.textSecondary,
  },
  proBadge: {
    backgroundColor: WarmColors.surfaceVariant,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  proBadgeActive: {
    backgroundColor: WarmColors.accent,
  },
  proBadgeText: {
    ...Typography.small,
    color: WarmColors.textPrimary,
    fontWeight: '600',
  },
  voiceButton: {
    backgroundColor: WarmColors.secondary,
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.level2,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 100, // Space for FAB
  },
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: WarmColors.textSecondary,
  },
  reminderCard: {
    backgroundColor: WarmColors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: WarmColors.border,
    ...Elevation.level2,
  },
  reminderCardFired: {
    backgroundColor: WarmColors.surfaceVariant,
    borderColor: WarmColors.divider,
    opacity: 0.85,
  },
  reminderContent: {
    flexDirection: 'row',
  },
  reminderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: WarmColors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  reminderIconContainerActive: {
    backgroundColor: `${WarmColors.primary}15`,
  },
  reminderTextContainer: {
    flex: 1,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  reminderTitle: {
    ...Typography.bodyBold,
    color: WarmColors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  firedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${WarmColors.success}15`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  firedBadgeText: {
    ...Typography.small,
    color: WarmColors.success,
    fontWeight: '600',
  },
  reminderDescription: {
    ...Typography.body,
    color: WarmColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  reminderMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...Typography.small,
    color: WarmColors.textSecondary,
  },
  firedAtContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 4,
  },
  firedAtText: {
    ...Typography.small,
    color: WarmColors.success,
    fontWeight: '500',
  },
  textFired: {
    color: WarmColors.textTertiary,
  },
  fab: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md + 80, // Above tab bar
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: WarmColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.level4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: WarmColors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h3,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyDescription: {
    ...Typography.body,
    color: WarmColors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 24,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WarmColors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    ...Elevation.level2,
  },
  emptyStateButtonText: {
    ...Typography.bodyBold,
    color: WarmColors.textOnPrimary,
  },
});
