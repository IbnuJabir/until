/**
 * Create Reminder Screen
 * Simple, sentence-based reminder creation per CONTEXT.md Phase 12
 */

import {
  createReminder,
  createSavedPlace,
  createScheduledTimeTrigger,
  createTrigger,
  LocationConfig,
  SavedPlace,
  TriggerType
} from '@/app/src/domain';
import { useScreenTime } from '@/app/src/hooks/useScreenTime';
import { useReminderStore } from '@/app/src/store/reminderStore';
import MapPicker from '@/app/src/ui/MapPicker';
import SavedPlacesList from '@/app/src/ui/SavedPlacesList';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function CreateReminderScreen() {
  const router = useRouter();
  const { addReminder, addSavedPlace, incrementPlaceUsage, entitlements } = useReminderStore();
  const screenTime = useScreenTime();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTriggers, setSelectedTriggers] = useState<TriggerType[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedAppCount, setSelectedAppCount] = useState<number>(0);
  const [selectedLocation, setSelectedLocation] = useState<LocationConfig | null>(null);
  const [showSavedPlacesList, setShowSavedPlacesList] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Scheduled time state
  const [scheduledDateTime, setScheduledDateTime] = useState<Date>(new Date(Date.now() + 3600000)); // Default: 1 hour from now
  const [tempDateTime, setTempDateTime] = useState<Date>(new Date(Date.now() + 3600000)); // Temporary selection
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Activation time state (for event-based triggers)
  const [activationDate, setActivationDate] = useState<Date | null>(null);
  const [activationTime, setActivationTime] = useState<Date | null>(null);
  const [tempActivationDateTime, setTempActivationDateTime] = useState<Date>(new Date());
  const [showActivationDatePicker, setShowActivationDatePicker] = useState(false);
  const [showActivationTimePicker, setShowActivationTimePicker] = useState(false);

  const isPro = entitlements.hasProAccess;

  // Check if user has selected apps when component mounts
  useEffect(() => {
    if (screenTime.hasAppsSelected) {
      console.log('[CreateReminder] User has previously selected apps');
    }
  }, [screenTime.hasAppsSelected]);

  const triggerOptions = [
    {
      type: TriggerType.SCHEDULED_TIME,
      label: 'At a specific time',
      icon: '⏰',
      isPro: false, // Free feature
    },
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

    // If selecting "When I arrive somewhere", show saved places list
    if (triggerType === TriggerType.LOCATION_ENTER) {
      if (!selectedTriggers.includes(triggerType)) {
        setShowSavedPlacesList(true);
      } else {
        // Deselecting - remove trigger and clear selected location
        setSelectedTriggers((prev) => prev.filter((t) => t !== triggerType));
        setSelectedLocation(null);
      }
      return;
    }

    // If selecting "At a specific time", show date/time picker
    if (triggerType === TriggerType.SCHEDULED_TIME) {
      if (!selectedTriggers.includes(triggerType)) {
        // Initialize temp with current scheduled time or 1 hour from now
        setTempDateTime(scheduledDateTime);
        setShowDatePicker(true);
      } else {
        // Deselecting - remove trigger
        setSelectedTriggers((prev) => prev.filter((t) => t !== triggerType));
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

  // Handle selecting an existing saved place
  const handleSelectSavedPlace = async (place: SavedPlace) => {
    setSelectedLocation({
      latitude: place.latitude,
      longitude: place.longitude,
      radius: place.radius,
      name: place.name,
    });
    setSelectedTriggers((prev) => [...prev, TriggerType.LOCATION_ENTER]);
    setShowSavedPlacesList(false);

    // Increment usage count for this place
    await incrementPlaceUsage(place.id);

    Alert.alert(
      'Location Set',
      `Reminder will trigger when you arrive at ${place.name} (within ${place.radius}m).`
    );
  };

  // Handle adding a new place (show map picker)
  const handleAddNewPlace = () => {
    setShowSavedPlacesList(false);
    setShowMapPicker(true);
  };

  // Handle saving a new place from map picker
  const handleMapPickerSave = async (location: LocationConfig & { name: string }) => {
    try {
      // Create and save the new place
      const newPlace = createSavedPlace(
        location.name,
        location.latitude,
        location.longitude,
        location.radius
      );
      await addSavedPlace(newPlace);

      // Set it as the selected location for this reminder
      setSelectedLocation(location);
      setSelectedTriggers((prev) => [...prev, TriggerType.LOCATION_ENTER]);
      setShowMapPicker(false);

      Alert.alert(
        'Location Saved',
        `"${location.name}" has been saved and set as the trigger location.`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save location. Please try again.');
    }
  };

  // Handle canceling map picker
  const handleMapPickerCancel = () => {
    setShowMapPicker(false);
    // Show saved places list again
    setShowSavedPlacesList(true);
  };

  // Handle date selection (just update temp state)
  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      // Update temporary date selection
      const newDateTime = new Date(tempDateTime);
      newDateTime.setFullYear(selectedDate.getFullYear());
      newDateTime.setMonth(selectedDate.getMonth());
      newDateTime.setDate(selectedDate.getDate());
      setTempDateTime(newDateTime);
    }
  };

  // Handle time selection (just update temp state)
  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (selectedTime) {
      // Update temporary time selection
      const newDateTime = new Date(tempDateTime);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      setTempDateTime(newDateTime);
    }
  };

  // Confirm date selection and move to time picker
  const handleDateConfirm = () => {
    setShowDatePicker(false);
    setShowTimePicker(true);
  };

  // Confirm time selection and add trigger
  const handleTimeConfirm = () => {
    // Validate that time is in the future
    if (tempDateTime.getTime() <= Date.now()) {
      Alert.alert(
        'Invalid Time',
        'Please select a time in the future.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset to 1 hour from now
              const newTime = new Date(Date.now() + 3600000);
              setTempDateTime(newTime);
              setScheduledDateTime(newTime);
            },
          },
        ]
      );
      return;
    }

    // Confirm the selection
    setScheduledDateTime(tempDateTime);
    setShowTimePicker(false);
    setSelectedTriggers((prev) => [...prev, TriggerType.SCHEDULED_TIME]);
  };

  // Handle canceling date/time picker
  const handleDateTimePickerCancel = () => {
    setShowDatePicker(false);
    setShowTimePicker(false);
    // Reset temp to current scheduled time
    setTempDateTime(scheduledDateTime);
  };

  // Activation date/time handlers
  const handleActivationDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setTempActivationDateTime(selectedDate);
    }
  };

  const handleActivationTimeChange = (event: any, selectedTime?: Date) => {
    if (selectedTime) {
      const newDateTime = new Date(tempActivationDateTime);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      setTempActivationDateTime(newDateTime);
    }
  };

  const handleActivationDateConfirm = () => {
    setActivationDate(tempActivationDateTime);
    setShowActivationDatePicker(false);
  };

  const handleActivationTimeConfirm = () => {
    setActivationTime(tempActivationDateTime);
    setShowActivationTimePicker(false);
  };

  const handleActivationPickerCancel = () => {
    setShowActivationDatePicker(false);
    setShowActivationTimePicker(false);
  };

  const handleClearActivationTime = () => {
    setActivationDate(null);
    setActivationTime(null);
  };

  // Calculate activation datetime based on selected date and time
  const calculateActivationDateTime = (): number | undefined => {
    // If neither date nor time is selected, return undefined (immediate activation)
    if (!activationDate && !activationTime) {
      return undefined;
    }

    const now = new Date();
    let result: Date;

    if (activationDate && activationTime) {
      // Both date and time selected: use the exact datetime
      result = new Date(activationDate);
      result.setHours(activationTime.getHours());
      result.setMinutes(activationTime.getMinutes());
      result.setSeconds(0);
      result.setMilliseconds(0);
    } else if (activationDate && !activationTime) {
      // Only date selected: use start of that day (00:00)
      result = new Date(activationDate);
      result.setHours(0);
      result.setMinutes(0);
      result.setSeconds(0);
      result.setMilliseconds(0);
    } else {
      // Only time selected: use today with that time
      result = new Date(now);
      result.setHours(activationTime!.getHours());
      result.setMinutes(activationTime!.getMinutes());
      result.setSeconds(0);
      result.setMilliseconds(0);
    }

    return result.getTime();
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
      // Calculate activation datetime for event-based triggers
      const activationDateTime = calculateActivationDateTime();

      // Create triggers with config for APP_OPENED, LOCATION_ENTER, and SCHEDULED_TIME
      const triggers = selectedTriggers.map((type) => {
        if (type === TriggerType.APP_OPENED) {
          // Screen Time API uses tokenized app identifiers (not bundle IDs)
          // Store a placeholder config - actual monitoring happens via native module
          return createTrigger(
            type,
            {
              bundleId: 'screentime.apps.selected',
              appName: `${selectedAppCount} selected app${selectedAppCount > 1 ? 's' : ''}`,
            },
            activationDateTime
          );
        }
        if (type === TriggerType.LOCATION_ENTER && selectedLocation) {
          return createTrigger(type, selectedLocation, activationDateTime);
        }
        if (type === TriggerType.SCHEDULED_TIME) {
          return createScheduledTimeTrigger(scheduledDateTime.getTime());
        }
        // For PHONE_UNLOCK and CHARGING_STARTED
        return createTrigger(type, null, activationDateTime);
      });

      // Create reminder
      const reminder = createReminder(title.trim(), triggers, [], description.trim());

      // Log location details if location trigger is selected
      // if (selectedTriggers.includes(TriggerType.LOCATION_ENTER) && selectedLocation) {
      //   console.log('=================================================');
      //   console.log('[CreateReminder] 📍 Location-based reminder created');
      //   console.log('[CreateReminder] Reminder title:', title.trim());
      //   console.log('[CreateReminder] Location name:', selectedLocation.name);
      //   console.log('[CreateReminder] Latitude:', selectedLocation.latitude);
      //   console.log('[CreateReminder] Longitude:', selectedLocation.longitude);
      //   console.log('[CreateReminder] Radius:', selectedLocation.radius, 'meters');
      //   console.log('=================================================');
      // }

      // Save to store (which persists to database)
      await addReminder(reminder);

      // Dismiss modal and navigate back to list page with toast
      router.dismissAll();
      router.replace('/(tabs)?message=Reminder created!' as any);
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
                  const isScheduledTimeTrigger = option.type === TriggerType.SCHEDULED_TIME;
                  const showAppCount = isAppTrigger && isSelected && selectedAppCount > 0;
                  const showLocationInfo = isLocationTrigger && isSelected && selectedLocation;
                  const showScheduledTime = isScheduledTimeTrigger && isSelected;

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
                          {showScheduledTime && (
                            <Text style={styles.selectedAppLabel}>
                              {scheduledDateTime.toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })} at {scheduledDateTime.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
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

              {/* Activation Time Section - Only show for event-based triggers */}
              {selectedTriggers.length > 0 &&
                !selectedTriggers.includes(TriggerType.SCHEDULED_TIME) && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>When should this trigger activate? (Optional)</Text>
                    <Text style={styles.sectionHint}>
                      Set a future date/time for when the trigger becomes active. Leave empty for immediate activation.
                    </Text>

                    <View style={styles.activationTimeContainer}>
                      <TouchableOpacity
                        style={styles.activationTimeButton}
                        onPress={() => {
                          setTempActivationDateTime(activationDate || new Date());
                          setShowActivationDatePicker(true);
                        }}
                      >
                        <Text style={styles.activationTimeButtonIcon}>📅</Text>
                        <View style={styles.activationTimeButtonText}>
                          <Text style={styles.activationTimeLabel}>Date</Text>
                          <Text style={styles.activationTimeValue}>
                            {activationDate
                              ? activationDate.toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Not set'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.activationTimeButton}
                        onPress={() => {
                          setTempActivationDateTime(activationTime || new Date());
                          setShowActivationTimePicker(true);
                        }}
                      >
                        <Text style={styles.activationTimeButtonIcon}>⏰</Text>
                        <View style={styles.activationTimeButtonText}>
                          <Text style={styles.activationTimeLabel}>Time</Text>
                          <Text style={styles.activationTimeValue}>
                            {activationTime
                              ? activationTime.toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Not set'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>

                    {(activationDate || activationTime) && (
                      <TouchableOpacity
                        style={styles.clearActivationButton}
                        onPress={handleClearActivationTime}
                      >
                        <Text style={styles.clearActivationText}>Clear activation time</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Saved Places List Modal */}
      {showSavedPlacesList && (
        <View style={styles.fullScreenModal}>
          <SavedPlacesList
            onSelectPlace={handleSelectSavedPlace}
            onAddNewPlace={handleAddNewPlace}
          />
          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={() => setShowSavedPlacesList(false)}
          >
            <Text style={styles.closeModalText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map Picker Modal */}
      <MapPicker
        visible={showMapPicker}
        onSave={handleMapPickerSave}
        onCancel={handleMapPickerCancel}
      />

      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showDatePicker}
          onRequestClose={handleDateTimePickerCancel}
        >
          <View style={styles.datePickerOverlay}>
            <TouchableOpacity
              style={styles.datePickerBackdrop}
              activeOpacity={1}
              onPress={handleDateTimePickerCancel}
            />
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select Date</Text>
                <TouchableOpacity onPress={handleDateTimePickerCancel}>
                  <Text style={styles.datePickerClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDateTime}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
              <View style={styles.datePickerButtons}>
                <TouchableOpacity
                  style={styles.datePickerCancelButton}
                  onPress={handleDateTimePickerCancel}
                >
                  <Text style={styles.datePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.datePickerConfirmButton}
                  onPress={handleDateConfirm}
                >
                  <Text style={styles.datePickerConfirmText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showTimePicker}
          onRequestClose={handleDateTimePickerCancel}
        >
          <View style={styles.datePickerOverlay}>
            <TouchableOpacity
              style={styles.datePickerBackdrop}
              activeOpacity={1}
              onPress={handleDateTimePickerCancel}
            />
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select Time</Text>
                <TouchableOpacity onPress={handleDateTimePickerCancel}>
                  <Text style={styles.datePickerClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDateTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
              />
              <View style={styles.datePickerButtons}>
                <TouchableOpacity
                  style={styles.datePickerCancelButton}
                  onPress={handleDateTimePickerCancel}
                >
                  <Text style={styles.datePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.datePickerConfirmButton}
                  onPress={handleTimeConfirm}
                >
                  <Text style={styles.datePickerConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Activation Date Picker Modal */}
      {showActivationDatePicker && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showActivationDatePicker}
          onRequestClose={handleActivationPickerCancel}
        >
          <View style={styles.datePickerOverlay}>
            <TouchableOpacity
              style={styles.datePickerBackdrop}
              activeOpacity={1}
              onPress={handleActivationPickerCancel}
            />
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select Activation Date</Text>
                <TouchableOpacity onPress={handleActivationPickerCancel}>
                  <Text style={styles.datePickerClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempActivationDateTime}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleActivationDateChange}
                minimumDate={new Date()}
              />
              <View style={styles.datePickerButtons}>
                <TouchableOpacity
                  style={styles.datePickerCancelButton}
                  onPress={handleActivationPickerCancel}
                >
                  <Text style={styles.datePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.datePickerConfirmButton}
                  onPress={handleActivationDateConfirm}
                >
                  <Text style={styles.datePickerConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Activation Time Picker Modal */}
      {showActivationTimePicker && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showActivationTimePicker}
          onRequestClose={handleActivationPickerCancel}
        >
          <View style={styles.datePickerOverlay}>
            <TouchableOpacity
              style={styles.datePickerBackdrop}
              activeOpacity={1}
              onPress={handleActivationPickerCancel}
            />
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select Activation Time</Text>
                <TouchableOpacity onPress={handleActivationPickerCancel}>
                  <Text style={styles.datePickerClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempActivationDateTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleActivationTimeChange}
              />
              <View style={styles.datePickerButtons}>
                <TouchableOpacity
                  style={styles.datePickerCancelButton}
                  onPress={handleActivationPickerCancel}
                >
                  <Text style={styles.datePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.datePickerConfirmButton}
                  onPress={handleActivationTimeConfirm}
                >
                  <Text style={styles.datePickerConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  fullScreenModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  closeModalButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#f0f0f0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeModalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  // Date/Time Picker Modal Styles
  datePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  datePickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  datePickerModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  datePickerClose: {
    fontSize: 24,
    color: '#999',
    fontWeight: '300',
  },
  datePickerButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  datePickerCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  datePickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  datePickerConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  datePickerConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Activation Time Styles
  activationTimeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  activationTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  activationTimeButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  activationTimeButtonText: {
    flex: 1,
  },
  activationTimeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  activationTimeValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  clearActivationButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearActivationText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
});
