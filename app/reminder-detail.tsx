/**
 * Reminder Detail Screen
 * Shows full details of a reminder and allows editing/deletion
 * Accessible from:
 * 1. Reminder list (tap on reminder)
 * 2. Push notification (deep link)
 */

import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useReminderStore } from '@/app/src/store/reminderStore';
import {
  Reminder,
  TriggerType,
  ReminderStatus,
  TriggerConfig,
  ScheduledTimeConfig,
  LocationConfig,
  AppOpenedConfig,
  TimeWindowConfig,
} from '@/app/src/domain';
import { format } from 'date-fns';
import { Toast } from '@/app/src/utils/Toast';
import { WarmColors, Elevation, Spacing, BorderRadius, Typography } from '@/constants/theme';

export default function ReminderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { reminders, deleteReminder, updateReminderStatus } = useReminderStore();

  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    // Don't show "not found" error if we're in the process of deleting
    if (isDeleting) return;

    if (!params.id) {
      router.back();
      return;
    }

    const found = reminders.find((r) => r.id === params.id);
    if (found) {
      setReminder(found);
    } else {
      Alert.alert(
        'Not Found',
        'This reminder may have been deleted or is no longer available.',
        [{ text: 'Go Back', onPress: () => router.back() }]
      );
    }
  }, [params.id, reminders, isDeleting]);

  const handleDelete = () => {
    if (!reminder) return;

    Alert.alert(
      'Delete Reminder',
      `Are you sure you want to delete "${reminder.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteReminder(reminder.id);
              // Navigate back and show toast on list page
              router.back();
              router.replace('/(tabs)?message=Reminder deleted' as any);
            } catch (error) {
              setIsDeleting(false);
              Alert.alert('Error', 'Failed to delete reminder');
            }
          },
        },
      ]
    );
  };

  const handleMarkAsWaiting = async () => {
    if (!reminder) return;

    try {
      await updateReminderStatus(reminder.id, ReminderStatus.WAITING);
      setToastMessage('Reminder reactivated');
      setShowToast(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to reactivate reminder');
    }
  };

  const getTriggerIcon = (type: TriggerType): keyof typeof MaterialIcons.glyphMap => {
    switch (type) {
      case TriggerType.TIME_WINDOW:
      case TriggerType.SCHEDULED_TIME:
        return 'schedule';
      case TriggerType.PHONE_UNLOCK:
        return 'smartphone';
      case TriggerType.LOCATION_ENTER:
        return 'location-on';
      case TriggerType.CHARGING_STARTED:
        return 'battery-charging-full';
      case TriggerType.APP_OPENED:
        return 'apps';
      default:
        return 'notifications';
    }
  };

  const getTriggerLabel = (type: TriggerType): string => {
    switch (type) {
      case TriggerType.TIME_WINDOW:
        return 'Time Window';
      case TriggerType.SCHEDULED_TIME:
        return 'At a specific time';
      case TriggerType.PHONE_UNLOCK:
        return 'Phone Unlock';
      case TriggerType.LOCATION_ENTER:
        return 'Location Enter';
      case TriggerType.CHARGING_STARTED:
        return 'Charging Started';
      case TriggerType.APP_OPENED:
        return 'App Opened';
      default:
        return 'Unknown';
    }
  };

  const formatTriggerConfig = (type: TriggerType, config: TriggerConfig): string => {
    if (!config) return '';

    switch (type) {
      case TriggerType.SCHEDULED_TIME: {
        const scheduledConfig = config as ScheduledTimeConfig;
        const date = new Date(scheduledConfig.scheduledDateTime);
        return format(date, 'MMM d, yyyy \'at\' h:mm a');
      }
      case TriggerType.LOCATION_ENTER: {
        const locationConfig = config as LocationConfig;
        return `${locationConfig.name || 'Location'} (${locationConfig.radius}m)`;
      }
      case TriggerType.APP_OPENED: {
        const appConfig = config as AppOpenedConfig;
        return appConfig.appName;
      }
      case TriggerType.TIME_WINDOW: {
        const timeConfig = config as TimeWindowConfig;
        return `${timeConfig.startHour}:00 - ${timeConfig.endHour}:00`;
      }
      default:
        return JSON.stringify(config, null, 2);
    }
  };

  if (!reminder) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="hourglass-empty" size={48} color={WarmColors.textTertiary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const isFired = reminder.status === ReminderStatus.FIRED;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={WarmColors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reminder Details</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton} activeOpacity={0.7}>
          <MaterialIcons name="delete-outline" size={24} color={WarmColors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          {/* Status Badge */}
          {isFired && (
            <View style={styles.statusPill}>
              <MaterialIcons name="check-circle" size={12} color={WarmColors.success} />
              <Text style={styles.statusPillText}>Completed</Text>
            </View>
          )}

          {/* Title */}
          <Text style={styles.title}>{reminder.title}</Text>

          {/* Description */}
          {reminder.description && (
            <Text style={styles.description}>{reminder.description}</Text>
          )}

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.statItem}>
              <MaterialIcons name="notifications-active" size={16} color={WarmColors.primary} />
              <Text style={styles.statText}>{reminder.triggers.length} trigger{reminder.triggers.length !== 1 ? 's' : ''}</Text>
            </View>
            {reminder.conditions.length > 0 && (
              <View style={styles.statItem}>
                <MaterialIcons name="rule" size={16} color={WarmColors.accent} />
                <Text style={styles.statText}>{reminder.conditions.length} condition{reminder.conditions.length !== 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Triggers Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>When</Text>
          <View style={styles.timelineContainer}>
            {reminder.triggers.map((trigger, index) => (
              <View key={trigger.id} style={styles.timelineItem}>
                {/* Timeline dot and line */}
                <View style={styles.timelineLeft}>
                  <View style={styles.timelineDot}>
                    <MaterialIcons
                      name={getTriggerIcon(trigger.type)}
                      size={14}
                      color={WarmColors.primary}
                    />
                  </View>
                  {index < reminder.triggers.length - 1 && (
                    <View style={styles.timelineLine} />
                  )}
                </View>

                {/* Trigger content */}
                <View style={styles.timelineContent}>
                  <Text style={styles.triggerLabel}>{getTriggerLabel(trigger.type)}</Text>
                  {trigger.config && (
                    <Text style={styles.triggerConfig}>
                      {formatTriggerConfig(trigger.type, trigger.config)}
                    </Text>
                  )}
                  {trigger.activationDateTime && trigger.type !== 'SCHEDULED_TIME' && (
                    <Text style={styles.triggerMeta}>
                      Active from {format(trigger.activationDateTime, 'MMM d, h:mm a')}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Conditions Section */}
        {reminder.conditions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Only If</Text>
            <View style={styles.conditionsContainer}>
              {reminder.conditions.map((condition) => (
                <View key={condition.id} style={styles.conditionItem}>
                  <View style={styles.conditionIcon}>
                    <MaterialIcons name="rule" size={14} color={WarmColors.accent} />
                  </View>
                  <Text style={styles.conditionText}>{condition.type}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Metadata Cards Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.metadataGrid}>
            {/* Created Card */}
            <View style={styles.metadataCard}>
              <View style={styles.metadataCardIcon}>
                <MaterialIcons name="calendar-today" size={18} color={WarmColors.info} />
              </View>
              <Text style={styles.metadataCardLabel}>Created</Text>
              <Text style={styles.metadataCardValue}>
                {format(reminder.createdAt, 'MMM d, yyyy')}
              </Text>
              <Text style={styles.metadataCardTime}>
                {format(reminder.createdAt, 'h:mm a')}
              </Text>
            </View>

            {/* Fired Card (if fired) */}
            {reminder.firedAt && (
              <View style={[styles.metadataCard, styles.metadataCardSuccess]}>
                <View style={styles.metadataCardIcon}>
                  <MaterialIcons name="check-circle" size={18} color={WarmColors.success} />
                </View>
                <Text style={styles.metadataCardLabel}>Completed</Text>
                <Text style={styles.metadataCardValue}>
                  {format(reminder.firedAt, 'MMM d, yyyy')}
                </Text>
                <Text style={styles.metadataCardTime}>
                  {format(reminder.firedAt, 'h:mm a')}
                </Text>
              </View>
            )}

            {/* Expires Card (if has expiration) */}
            {reminder.expiresAt && (
              <View style={styles.metadataCard}>
                <View style={styles.metadataCardIcon}>
                  <MaterialIcons name="event-busy" size={18} color={WarmColors.warning} />
                </View>
                <Text style={styles.metadataCardLabel}>Expires</Text>
                <Text style={styles.metadataCardValue}>
                  {format(reminder.expiresAt, 'MMM d, yyyy')}
                </Text>
                <Text style={styles.metadataCardTime}>
                  {format(reminder.expiresAt, 'h:mm a')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Reactivate Button (if fired) */}
        {isFired && (
          <TouchableOpacity
            style={styles.reactivateButton}
            onPress={handleMarkAsWaiting}
            activeOpacity={0.8}
          >
            <MaterialIcons name="refresh" size={20} color={WarmColors.textOnPrimary} />
            <Text style={styles.reactivateButtonText}>Reactivate Reminder</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

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
    paddingTop: 60,
    paddingHorizontal: Spacing.compact.md,
    paddingBottom: Spacing.compact.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: WarmColors.borderLight,
    ...Elevation.level1,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h4,
    color: WarmColors.textPrimary,
  },
  deleteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    color: WarmColors.textSecondary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
  },
  // Hero Section
  heroSection: {
    marginBottom: Spacing.lg,
  },
  statusPill: {
    backgroundColor: `${WarmColors.success}15`,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.compact.md,
    paddingVertical: Spacing.compact.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.compact.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.compact.xs,
  },
  statusPillText: {
    ...Typography.tiny,
    color: WarmColors.success,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    ...Typography.h2,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.compact.md,
    letterSpacing: -0.8,
  },
  description: {
    ...Typography.body,
    color: WarmColors.textSecondary,
    lineHeight: 26,
    marginBottom: Spacing.md,
  },
  quickStats: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.compact.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.compact.xs,
    backgroundColor: WarmColors.surface,
    paddingHorizontal: Spacing.compact.md,
    paddingVertical: Spacing.compact.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 0.5,
    borderColor: WarmColors.borderLight,
  },
  statText: {
    ...Typography.tiny,
    color: WarmColors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  // Section
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.md,
    letterSpacing: -0.3,
  },
  // Timeline for triggers
  timelineContainer: {
    paddingLeft: Spacing.compact.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${WarmColors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: WarmColors.primary,
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: WarmColors.divider,
    marginTop: Spacing.compact.xs,
  },
  timelineContent: {
    flex: 1,
    paddingTop: Spacing.compact.xs,
  },
  triggerLabel: {
    ...Typography.cardTitle,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.compact.xs,
  },
  triggerConfig: {
    ...Typography.small,
    color: WarmColors.textSecondary,
    lineHeight: 18,
  },
  triggerMeta: {
    ...Typography.tiny,
    color: WarmColors.textTertiary,
    marginTop: Spacing.compact.xs,
    fontStyle: 'italic',
  },
  // Conditions
  conditionsContainer: {
    gap: Spacing.compact.sm,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${WarmColors.accent}12`,
    paddingHorizontal: Spacing.compact.md,
    paddingVertical: Spacing.compact.sm + 2,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: WarmColors.accent,
  },
  conditionIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: `${WarmColors.accent}25`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.compact.sm,
  },
  conditionText: {
    ...Typography.small,
    color: WarmColors.textPrimary,
    fontWeight: '500',
  },
  // Metadata Grid
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.compact.md,
  },
  metadataCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: WarmColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: WarmColors.borderLight,
    ...Elevation.level1,
  },
  metadataCardSuccess: {
    backgroundColor: `${WarmColors.success}08`,
    borderColor: `${WarmColors.success}30`,
  },
  metadataCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: WarmColors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.compact.sm,
  },
  metadataCardLabel: {
    ...Typography.tiny,
    color: WarmColors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: Spacing.compact.xs,
    letterSpacing: 0.5,
  },
  metadataCardValue: {
    ...Typography.cardTitle,
    color: WarmColors.textPrimary,
    marginBottom: 2,
  },
  metadataCardTime: {
    ...Typography.tiny,
    color: WarmColors.textTertiary,
  },
  // Reactivate Button
  reactivateButton: {
    backgroundColor: WarmColors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Elevation.level2,
  },
  reactivateButtonText: {
    ...Typography.bodyBold,
    color: WarmColors.textOnPrimary,
  },
});
