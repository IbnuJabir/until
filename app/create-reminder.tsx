/**
 * Create Reminder Screen
 * Simple, sentence-based reminder creation per CONTEXT.md Phase 12
 */

import {
  TriggerType,
  createReminder,
  createTrigger,
  LocationConfig,
} from '@/app/src/domain';
import { useReminderStore } from '@/app/src/store/reminderStore';
import { useScreenTime } from '@/app/src/hooks/useScreenTime';
import LocationPicker from '@/app/src/ui/LocationPicker';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';

export default function CreateReminderScreen() {
  const router = useRouter();
  const { addReminder, entitlements } = useReminderStore();
  const screenTime = useScreenTime();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTriggers, setSelectedTriggers] = useState<TriggerType[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedAppCount, setSelectedAppCount] = useState<number>(0);
  const [selectedLocation, setSelectedLocation] = useState<LocationConfig | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const isPro = entitlements.hasProAccess;

  // Check if user has selected apps when component mounts
  useEffect(() => {
    if (screenTime.hasAppsSelected) {
      console.log('[CreateReminder] User has previously selected apps');
    }
  }, [screenTime.hasAppsSelected]);

  const triggerOptions = [
    {
      type: TriggerType.PHONE_UNLOCK,
      label: 'When I unlock my phone',
      icon: '📱',
      isPro: false, // Free for testing
    },
    {
      type: TriggerType.CHARGING_STARTED,
      label: 'When I start charging',
      icon: '🔌',
      isPro: false, // TEMP: Disabled for testing (was: true)
    },
    {
      type: TriggerType.LOCATION_ENTER,
      label: 'When I arrive somewhere',
      icon: '📍',
      isPro: false, // TEMP: Disabled for testing (was: true)
    },
    {
      type: TriggerType.APP_OPENED,
      label: 'When I open an app',
      icon: '📲',
      isPro: false, // TEMP: Disabled for testing (was: true)
    },
  ];

  const toggleTrigger = async (triggerType: TriggerType, requiresPro: boolean) => {
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

    // If selecting "When I open an app", handle Screen Time flow
    if (triggerType === TriggerType.APP_OPENED) {
      if (!selectedTriggers.includes(triggerType)) {
        await handleAppTriggerSelection();
      } else {
        // Deselecting - remove trigger and clear selected apps
        setSelectedTriggers((prev) => prev.filter((t) => t !== triggerType));
        setSelectedAppCount(0);
        await screenTime.clearApps();
      }
      return;
    }

    // If selecting "When I arrive somewhere", show location picker
    if (triggerType === TriggerType.LOCATION_ENTER) {
      if (!selectedTriggers.includes(triggerType)) {
        setShowLocationPicker(true);
      } else {
        // Deselecting - remove trigger and clear selected location
        setSelectedTriggers((prev) => prev.filter((t) => t !== triggerType));
        setSelectedLocation(null);
      }
      return;
    }

    setSelectedTriggers((prev) =>
      prev.includes(triggerType)
        ? prev.filter((t) => t !== triggerType)
        : [...prev, triggerType]
    );
  };

  const handleAppTriggerSelection = async () => {
    // Step 1: Check if already authorized
    if (!screenTime.isAuthorized) {
      // Request permission first
      Alert.alert(
        'Screen Time Permission Required',
        'Until needs Screen Time permission to detect when you open specific apps. You will choose which apps to monitor.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: async () => {
              await screenTime.requestPermission();

              // After permission, check if authorized and continue
              if (screenTime.isAuthorized) {
                await showAppPickerFlow();
              }
            },
          },
        ]
      );
      return;
    }

    // Step 2: Show app picker
    await showAppPickerFlow();
  };

  const showAppPickerFlow = async () => {
    try {
      const result = await screenTime.showAppPicker();

      if (result && result.selectedCount > 0) {
        // User selected apps successfully
        setSelectedAppCount(result.selectedCount);
        setSelectedTriggers((prev) => [...prev, TriggerType.APP_OPENED]);

        Alert.alert(
          'Apps Selected',
          `You selected ${result.selectedCount} app${result.selectedCount > 1 ? 's' : ''}. This reminder will trigger when you open any of them.`
        );
      }
    } catch (error) {
      console.error('[CreateReminder] Failed to show app picker:', error);
      Alert.alert('Error', 'Failed to show app picker. Please try again.');
    }
  };

  const handleLocationSave = (location: LocationConfig) => {
    setSelectedLocation(location);
    setSelectedTriggers((prev) => [...prev, TriggerType.LOCATION_ENTER]);
    setShowLocationPicker(false);

    Alert.alert(
      'Location Set',
      `Reminder will trigger when you arrive at ${location.name || 'the selected location'} (within ${location.radius}m).`
    );
  };

  const handleLocationCancel = () => {
    setShowLocationPicker(false);
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

    // Validate app selection if APP_OPENED trigger is selected
    if (selectedTriggers.includes(TriggerType.APP_OPENED) && selectedAppCount === 0) {
      Alert.alert('Error', 'Please select apps to monitor for the app trigger');
      return;
    }

    // Validate location selection if LOCATION_ENTER trigger is selected
    if (selectedTriggers.includes(TriggerType.LOCATION_ENTER) && !selectedLocation) {
      Alert.alert('Error', 'Please select a location for the location trigger');
      return;
    }

    setIsCreating(true);

    try {
      // Create triggers with config for APP_OPENED and LOCATION_ENTER
      const triggers = selectedTriggers.map((type) => {
        if (type === TriggerType.APP_OPENED) {
          // Screen Time API uses tokenized app identifiers (not bundle IDs)
          // Store a placeholder config - actual monitoring happens via native module
          return createTrigger(type, {
            bundleId: 'screentime.apps.selected',
            appName: `${selectedAppCount} selected app${selectedAppCount > 1 ? 's' : ''}`,
          });
        }
        if (type === TriggerType.LOCATION_ENTER && selectedLocation) {
          return createTrigger(type, selectedLocation);
        }
        return createTrigger(type);
      });

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
                  const isAppTrigger = option.type === TriggerType.APP_OPENED;
                  const isLocationTrigger = option.type === TriggerType.LOCATION_ENTER;
                  const showAppCount = isAppTrigger && isSelected && selectedAppCount > 0;
                  const showLocationInfo = isLocationTrigger && isSelected && selectedLocation;

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
                      disabled={screenTime.isLoading}
                    >
                      <View style={styles.triggerLeft}>
                        <Text style={styles.triggerIcon}>{option.icon}</Text>
                        <View style={styles.triggerTextContainer}>
                          <Text style={styles.triggerLabel}>{option.label}</Text>
                          {showAppCount && (
                            <Text style={styles.selectedAppLabel}>
                              {selectedAppCount} app{selectedAppCount > 1 ? 's' : ''} selected
                            </Text>
                          )}
                          {showLocationInfo && (
                            <Text style={styles.selectedAppLabel}>
                              {selectedLocation.name} ({selectedLocation.radius}m)
                            </Text>
                          )}
                          {isLocked && (
                            <Text style={styles.proLabel}>Pro Feature</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.triggerRight}>
                        {screenTime.isLoading && isAppTrigger ? (
                          <ActivityIndicator size="small" />
                        ) : isLocked ? (
                          <Text style={styles.lockIcon}>🔒</Text>
                        ) : (
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

              {/* TEMP: Pro upsell disabled for testing */}
              {/* {!isPro && (
                <TouchableOpacity
                  style={styles.proUpsell}
                  onPress={() => router.push('/paywall' as any)}
                >
                  <Text style={styles.proUpsellTitle}>✨ Unlock All Triggers</Text>
                  <Text style={styles.proUpsellText}>
                    Get location-based, charging, and app-opened reminders with Until Pro
                  </Text>
                </TouchableOpacity>
              )} */}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location Picker Modal */}
      <LocationPicker
        visible={showLocationPicker}
        onSave={handleLocationSave}
        onCancel={handleLocationCancel}
      />
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
  selectedAppLabel: {
    fontSize: 12,
    color: '#007AFF',
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
  // App Picker Modal Styles
  appPickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  appPickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  appPickerModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '85%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  appPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  appPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  appPickerClose: {
    fontSize: 24,
    color: '#999',
    fontWeight: '300',
  },
  appPickerList: {
    maxHeight: 400,
  },
  appPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  appPickerItemIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  appPickerItemName: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
});
