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

    const found = reminders.find((r) => r.id === params.id);
    if (found) {
      setReminder(found);
    } else {
      // Reminder not found - maybe it was deleted
      Alert.alert('Error', 'Reminder not found', [
        { text: 'OK', onPress: () => router.back() },
      ]);
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
        {/* Status Badge */}
        {isFired && (
          <View style={styles.statusBadge}>
            <MaterialIcons name="check-circle" size={16} color={WarmColors.textOnPrimary} />
            <Text style={styles.statusBadgeText}>Fired</Text>
          </View>
        )}

        {/* Title */}
        <Text style={styles.title}>{reminder.title}</Text>

        {/* Description */}
        {reminder.description && (
          <View style={styles.section}>
            <Text style={styles.description}>{reminder.description}</Text>
          </View>
        )}

        {/* Triggers Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Triggers ({reminder.triggers.length})
          </Text>
          {reminder.triggers.map((trigger) => (
            <View key={trigger.id} style={styles.triggerCard}>
              <View style={styles.triggerIconContainer}>
                <MaterialIcons 
                  name={getTriggerIcon(trigger.type)} 
                  size={24} 
                  color={WarmColors.primary} 
                />
              </View>
              <View style={styles.triggerDetails}>
                <Text style={styles.triggerLabel}>{getTriggerLabel(trigger.type)}</Text>
                {trigger.config && (
                  <Text style={styles.triggerConfig}>
                    {formatTriggerConfig(trigger.type, trigger.config)}
                  </Text>
                )}
                {trigger.activationDateTime && (
                  <Text style={styles.triggerActivation}>
                    Active from: {format(trigger.activationDateTime, 'MMM d, yyyy \'at\' h:mm a')}
                  </Text>
                )}
                {!trigger.activationDateTime && trigger.type !== 'SCHEDULED_TIME' && (
                  <Text style={styles.triggerActivation}>
                    Active immediately
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Conditions Section */}
        {reminder.conditions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Conditions ({reminder.conditions.length})
            </Text>
            {reminder.conditions.map((condition) => (
              <View key={condition.id} style={styles.conditionCard}>
                <Text style={styles.conditionType}>{condition.type}</Text>
                <Text style={styles.conditionConfig}>
                  {JSON.stringify(condition.config, null, 2)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Metadata Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>

          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Status:</Text>
            <Text style={[styles.metadataValue, isFired && styles.firedText]}>
              {reminder.status}
            </Text>
          </View>

          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Created:</Text>
            <Text style={styles.metadataValue}>
              {format(reminder.createdAt, 'MMM d, yyyy h:mm a')}
            </Text>
          </View>

          {reminder.firedAt && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Fired:</Text>
              <Text style={[styles.metadataValue, styles.firedText]}>
                {format(reminder.firedAt, 'MMM d, yyyy h:mm a')}
              </Text>
            </View>
          )}

          {reminder.expiresAt && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Expires:</Text>
              <Text style={styles.metadataValue}>
                {format(reminder.expiresAt, 'MMM d, yyyy h:mm a')}
              </Text>
            </View>
          )}

          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>ID:</Text>
            <Text style={[styles.metadataValue, styles.idText]}>
              {reminder.id}
            </Text>
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: WarmColors.border,
    ...Elevation.level1,
  },
  backButton: {
    paddingVertical: Spacing.xs,
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
    paddingVertical: Spacing.xs,
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
  statusBadge: {
    backgroundColor: WarmColors.success,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusBadgeText: {
    ...Typography.caption,
    color: WarmColors.textOnPrimary,
    fontWeight: '600',
  },
  title: {
    ...Typography.h2,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.md,
  },
  description: {
    ...Typography.body,
    color: WarmColors.textSecondary,
    lineHeight: 24,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.md,
  },
  triggerCard: {
    backgroundColor: WarmColors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: WarmColors.border,
    ...Elevation.level2,
  },
  triggerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${WarmColors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  triggerDetails: {
    flex: 1,
  },
  triggerLabel: {
    ...Typography.bodyBold,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  triggerConfig: {
    ...Typography.small,
    color: WarmColors.textSecondary,
    fontFamily: 'monospace',
    marginTop: Spacing.xs,
  },
  triggerActivation: {
    ...Typography.small,
    color: WarmColors.primary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  conditionCard: {
    backgroundColor: `${WarmColors.accent}20`,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: WarmColors.accent,
  },
  conditionType: {
    ...Typography.caption,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  conditionConfig: {
    ...Typography.small,
    color: WarmColors.textSecondary,
    fontFamily: 'monospace',
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: WarmColors.border,
  },
  metadataLabel: {
    ...Typography.body,
    color: WarmColors.textSecondary,
    fontWeight: '500',
  },
  metadataValue: {
    ...Typography.body,
    color: WarmColors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  firedText: {
    color: WarmColors.success,
    fontWeight: '600',
  },
  idText: {
    ...Typography.small,
    fontFamily: 'monospace',
    fontSize: 10,
  },
  reactivateButton: {
    backgroundColor: WarmColors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
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
