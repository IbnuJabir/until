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
import { useReminderStore } from '@/app/src/store/reminderStore';
import { Reminder, TriggerType, ReminderStatus } from '@/app/src/domain';
import { format } from 'date-fns';

export default function ReminderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { reminders, deleteReminder, updateReminderStatus } = useReminderStore();

  const [reminder, setReminder] = useState<Reminder | null>(null);

  useEffect(() => {
    const found = reminders.find((r) => r.id === params.id);
    if (found) {
      setReminder(found);
    } else {
      // Reminder not found - maybe it was deleted
      Alert.alert('Error', 'Reminder not found', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }, [params.id, reminders]);

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
              await deleteReminder(reminder.id);
              router.back();
            } catch (error) {
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
      Alert.alert('Success', 'Reminder reactivated');
    } catch (error) {
      Alert.alert('Error', 'Failed to reactivate reminder');
    }
  };

  const getTriggerIcon = (type: TriggerType): string => {
    switch (type) {
      case TriggerType.TIME_WINDOW:
        return '⏰';
      case TriggerType.PHONE_UNLOCK:
        return '📱';
      case TriggerType.LOCATION_ENTER:
        return '📍';
      case TriggerType.CHARGING_STARTED:
        return '🔋';
      case TriggerType.APP_OPENED:
        return '📲';
      default:
        return '🔔';
    }
  };

  const getTriggerLabel = (type: TriggerType): string => {
    switch (type) {
      case TriggerType.TIME_WINDOW:
        return 'Time Window';
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

  if (!reminder) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Status Badge */}
        {isFired && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>✓ Fired</Text>
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
              <Text style={styles.triggerIcon}>{getTriggerIcon(trigger.type)}</Text>
              <View style={styles.triggerDetails}>
                <Text style={styles.triggerLabel}>{getTriggerLabel(trigger.type)}</Text>
                {trigger.config && (
                  <Text style={styles.triggerConfig}>
                    {JSON.stringify(trigger.config, null, 2)}
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
          >
            <Text style={styles.reactivateButtonText}>Reactivate Reminder</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  deleteButton: {
    paddingVertical: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  statusBadge: {
    backgroundColor: '#4CAF50',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  triggerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  triggerIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  triggerDetails: {
    flex: 1,
  },
  triggerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  triggerConfig: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  conditionCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  conditionType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  conditionConfig: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  metadataLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 14,
    color: '#000',
    flex: 1,
    textAlign: 'right',
  },
  firedText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  idText: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  reactivateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  reactivateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
