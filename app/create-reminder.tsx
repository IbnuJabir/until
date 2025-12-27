/**
 * Create Reminder Screen
 * Simple, sentence-based reminder creation per CONTEXT.md Phase 12
 */

import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useReminderStore } from '@/app/src/store/reminderStore';
import {
  TriggerType,
  createReminder,
  createTrigger,
} from '@/app/src/domain';

export default function CreateReminderScreen() {
  const router = useRouter();
  const { addReminder, entitlements } = useReminderStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTriggers, setSelectedTriggers] = useState<TriggerType[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const isPro = entitlements.hasProAccess;

  const triggerOptions = [
    {
      type: TriggerType.PHONE_UNLOCK,
      label: 'When I unlock my phone',
      icon: '📱',
      isPro: false,
    },
    {
      type: TriggerType.CHARGING_STARTED,
      label: 'When I start charging',
      icon: '🔌',
      isPro: true,
    },
    {
      type: TriggerType.LOCATION_ENTER,
      label: 'When I arrive somewhere',
      icon: '📍',
      isPro: true,
    },
    {
      type: TriggerType.APP_OPENED,
      label: 'When I open an app',
      icon: '📲',
      isPro: true,
    },
  ];

  const toggleTrigger = (triggerType: TriggerType, requiresPro: boolean) => {
    if (requiresPro && !isPro) {
      Alert.alert(
        'Pro Feature',
        'This trigger requires Until Pro. Upgrade to unlock all context triggers!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/paywall' as any) },
        ]
      );
      return;
    }

    setSelectedTriggers((prev) =>
      prev.includes(triggerType)
        ? prev.filter((t) => t !== triggerType)
        : [...prev, triggerType]
    );
  };

  const handleCreate = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a reminder title');
      return;
    }

    if (selectedTriggers.length === 0) {
      Alert.alert('Error', 'Please select at least one trigger');
      return;
    }

    setIsCreating(true);

    try {
      // Create triggers
      const triggers = selectedTriggers.map((type) => createTrigger(type));

      // Create reminder
      const reminder = createReminder(title.trim(), triggers, [], description.trim());

      // Save to store (which persists to database)
      await addReminder(reminder);

      Alert.alert('Success', 'Reminder created!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create reminder'
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.modalContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.handleBar}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Reminder</Text>
          <TouchableOpacity onPress={handleCreate} disabled={isCreating}>
            <Text style={[styles.saveButton, isCreating && styles.saveButtonDisabled]}>
              {isCreating ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>What do you want to remember?</Text>
                <TextInput
                  style={styles.titleInput}
                  placeholder="e.g., Call mom, Buy groceries"
                  value={title}
                  onChangeText={setTitle}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  Notes <Text style={styles.optional}>(optional)</Text>
                </Text>
                <TextInput
                  style={styles.descriptionInput}
                  placeholder="Add any details..."
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>When should we remind you?</Text>
                <Text style={styles.sectionHint}>
                  Select one or more triggers. All must be true to fire the reminder.
                </Text>

                {triggerOptions.map((option) => {
                  const isSelected = selectedTriggers.includes(option.type);
                  const isLocked = option.isPro && !isPro;

                  return (
                    <TouchableOpacity
                      key={option.type}
                      style={[
                        styles.triggerOption,
                        isSelected && styles.triggerOptionSelected,
                        isLocked && styles.triggerOptionLocked,
                      ]}
                      onPress={() => toggleTrigger(option.type, option.isPro)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.triggerLeft}>
                        <Text style={styles.triggerIcon}>{option.icon}</Text>
                        <View style={styles.triggerTextContainer}>
                          <Text style={styles.triggerLabel}>{option.label}</Text>
                          {isLocked && (
                            <Text style={styles.proLabel}>Pro Feature</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.triggerRight}>
                        {isLocked && <Text style={styles.lockIcon}>🔒</Text>}
                        {!isLocked && (
                          <View
                            style={[
                              styles.checkbox,
                              isSelected && styles.checkboxSelected,
                            ]}
                          >
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!isPro && (
                <TouchableOpacity
                  style={styles.proUpsell}
                  onPress={() => router.push('/paywall' as any)}
                >
                  <Text style={styles.proUpsellTitle}>✨ Unlock All Triggers</Text>
                  <Text style={styles.proUpsellText}>
                    Get location-based, charging, and app-opened reminders with Until Pro
                  </Text>
                </TouchableOpacity>
              )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  handleBar: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 5,
    backgroundColor: '#D1D1D6',
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  cancelButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  optional: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999',
  },
  sectionHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  titleInput: {
    fontSize: 16,
    color: '#000',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  descriptionInput: {
    fontSize: 16,
    color: '#000',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    minHeight: 80,
  },
  triggerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  triggerOptionSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  triggerOptionLocked: {
    opacity: 0.6,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  triggerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  triggerTextContainer: {
    flex: 1,
  },
  triggerLabel: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  proLabel: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '600',
    marginTop: 2,
  },
  triggerRight: {
    marginLeft: 12,
  },
  lockIcon: {
    fontSize: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  proUpsell: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 12,
    margin: 16,
    marginTop: 8,
  },
  proUpsellTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  proUpsellText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
});
