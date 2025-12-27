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
import { useRouter } from 'expo-router';
import { useReminderStore } from '@/app/src/store/reminderStore';
import { Reminder, ReminderStatus, isReminderActive } from '@/app/src/domain';
import { format } from 'date-fns';

export default function RemindersScreen() {
  const router = useRouter();
  const {
    reminders,
    deleteReminder,
    loadFromStorage,
    isLoading,
    entitlements,
    canAddMoreReminders,
  } = useReminderStore();

  const [refreshing, setRefreshing] = useState(false);

  // Load reminders on mount
  useEffect(() => {
    loadFromStorage();
  }, []);

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

  const renderReminderItem = ({ item }: { item: Reminder }) => {
    const isFired = item.status === ReminderStatus.FIRED;

    return (
      <TouchableOpacity
        style={[styles.reminderCard, isFired && styles.reminderCardFired]}
        onLongPress={() => handleDeleteReminder(item.id, item.title)}
        activeOpacity={0.7}
      >
        <View style={styles.reminderHeader}>
          <Text style={[styles.reminderTitle, isFired && styles.textFired]}>
            {item.title}
          </Text>
          {isFired && <Text style={styles.firedBadge}>Fired</Text>}
        </View>

        {item.description && (
          <Text style={[styles.reminderDescription, isFired && styles.textFired]}>
            {item.description}
          </Text>
        )}

        <View style={styles.reminderMeta}>
          <Text style={[styles.metaText, isFired && styles.textFired]}>
            {item.triggers.length} trigger{item.triggers.length !== 1 ? 's' : ''}
          </Text>
          <Text style={[styles.metaText, isFired && styles.textFired]}>
            Created {format(item.createdAt, 'MMM d, yyyy')}
          </Text>
        </View>

        {isFired && item.firedAt && (
          <Text style={styles.firedAtText}>
            Fired {format(item.firedAt, 'MMM d, h:mm a')}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📝</Text>
      <Text style={styles.emptyTitle}>No Reminders Yet</Text>
      <Text style={styles.emptyDescription}>
        Create your first context-aware reminder
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Until</Text>
          <Text style={styles.headerSubtitle}>
            {entitlements.hasProAccess ? 'Pro' : 'Free'} •{' '}
            {activeReminders.length} active
          </Text>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateReminder}
        >
          <Text style={styles.createButtonText}>+ New</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          reminders.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Active Reminders ({activeReminders.length})
              </Text>
            </View>
          ) : null
        }
      />
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
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  reminderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reminderCardFired: {
    backgroundColor: '#F9F9F9',
    opacity: 0.7,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reminderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  firedBadge: {
    backgroundColor: '#4CAF50',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  reminderDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  reminderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#999',
  },
  firedAtText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 8,
    fontWeight: '500',
  },
  textFired: {
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
