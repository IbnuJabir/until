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
import { BorderRadius, Elevation, Spacing, Typography, WarmColors } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
  const [selectedAppDetails, setSelectedAppDetails] = useState<{
    appCount: number;
    categoryCount: number;
    webDomainCount: number;
  }>({ appCount: 0, categoryCount: 0, webDomainCount: 0 });
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [selectedAppNames, setSelectedAppNames] = useState<string[]>([]);
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
      icon: 'schedule' as keyof typeof MaterialIcons.glyphMap,
      isPro: false, // Free feature
    },
    {
      type: TriggerType.PHONE_UNLOCK,
      label: 'When I unlock my phone',
      icon: 'smartphone' as keyof typeof MaterialIcons.glyphMap,
      isPro: false, // Free for testing
    },
    {
      type: TriggerType.CHARGING_STARTED,
      label: 'When I start charging',
      icon: 'battery-charging-full' as keyof typeof MaterialIcons.glyphMap,
      isPro: false, // TEMP: Disabled for testing (was: true)
    },
    {
      type: TriggerType.LOCATION_ENTER,
      label: 'When I arrive somewhere',
      icon: 'location-on' as keyof typeof MaterialIcons.glyphMap,
      isPro: false, // TEMP: Disabled for testing (was: true)
    },
    {
      type: TriggerType.APP_OPENED,
      label: 'When I open an app',
      icon: 'apps' as keyof typeof MaterialIcons.glyphMap,
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
        // First time selecting - show app picker
        await handleAppTriggerSelection();
      } else {
        // Already selected - allow user to change app or deselect
        Alert.alert(
          'App Trigger Selected',
          `${selectedAppCount} app(s) selected.\n\nWhat would you like to do?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Change Apps',
              onPress: async () => {
                // Clear current selection and show picker again
                await screenTime.clearApps();
                setSelectedAppIds([]);
                setSelectedAppNames([]);
                setSelectedAppCount(0)
                // Show the picker directly
                await showAppPickerFlow();
              }
            },
            {
              text: 'Remove Trigger',
              style: 'destructive',
              onPress: async () => {
                setSelectedTriggers((prev) => prev.filter((t) => t !== triggerType));
                setSelectedAppIds([]);
                setSelectedAppNames([]);
                setSelectedAppCount(0);
                await screenTime.clearApps();
              }
            }
          ]
        );
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
    console.log('[CreateReminder] handleAppTriggerSelection called');
    console.log('[CreateReminder] Auth status:', screenTime.authStatus);
    console.log('[CreateReminder] Is authorized:', screenTime.isAuthorized);
    console.log('[CreateReminder] Is loading:', screenTime.isLoading);
    console.log('[CreateReminder] Error:', screenTime.error);

    // Wait for loading to finish before proceeding
    if (screenTime.isLoading) {
      console.log('[CreateReminder] Still loading, waiting...');
      return;
    }

    // Check if ScreenTime module is available (only if error exists or status is truly unknown after loading)
    if (screenTime.authStatus === 'unknown' && screenTime.error) {
      console.log('[CreateReminder] Module not available');
      Alert.alert(
        'Feature Not Available',
        'Screen Time monitoring is not available on this device. This feature requires native iOS modules that need to be built with Xcode.\n\nPlease build the app using Xcode or use the npm script: npm run run:ios:device',
        [{ text: 'OK' }]
      );
      return;
    }

    // Step 1: Check if already authorized
    if (!screenTime.isAuthorized) {
      console.log('[CreateReminder] Not authorized, showing permission alert');
      // Request permission first
      Alert.alert(
        'Screen Time Permission Required',
        'Until needs Screen Time permission to detect when you open specific apps. You will choose which apps to monitor.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: async () => {
              console.log('[CreateReminder] User tapped Continue, requesting permission...');
              try {
                const status = await screenTime.requestPermission();
                console.log('[CreateReminder] Permission result:', status);

                // After permission, check if authorized and continue
                if (status === 'approved') {
                  await showAppPickerFlow();
                } else {
                  Alert.alert(
                    'Permission Denied',
                    'Screen Time permission is required for app-based reminders. Please enable it in Settings.',
                    [{ text: 'OK' }]
                  );
                }
              } catch (error: any) {
                console.error('[CreateReminder] Permission request failed:', error);
                Alert.alert(
                  'Error',
                  error.message || 'Failed to request Screen Time permission. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            },
          },
        ]
      );
      return;
    }

    // Step 2: Show app picker
    console.log('[CreateReminder] Already authorized, showing app picker');
    await showAppPickerFlow();
  };

  const showAppPickerFlow = async () => {
    console.log('[CreateReminder] showAppPickerFlow called (Global App Library mode)');
    try {
      console.log('[CreateReminder] Calling screenTime.showAppPicker()...');
      const result = await screenTime.showAppPicker();
      console.log('[CreateReminder] App picker result:', result);

      if (result && result.selectedCount > 0) {
        console.log('[CreateReminder] User selected', result.selectedCount, 'app(s)');

        // IMPORTANT: With global library, user should select ONE app per reminder
        // Generate unique ID for this app
        const timestamp = Date.now();
        const appIds = Array.from({ length: result.selectedCount }, (_, i) =>
          `app_${timestamp}_${i}`
        );

        console.log('[CreateReminder] Adding apps to global library with IDs:', appIds);

        // Add apps to global library
        const { addAppsToLibrary } = await import('@/app/src/native-bridge/ScreenTimeBridge');
        const success = await addAppsToLibrary(appIds);

        if (!success) {
          throw new Error('Failed to add apps to global library');
        }

        console.log('[CreateReminder] ✅ Apps added to global library successfully');

        // Store all selected app IDs and names
        setSelectedAppIds(appIds);
        // In a real app, you'd get the actual app names from the picker result
        const appNames = appIds.map((id, i) => `App ${timestamp}_${i}`);
        setSelectedAppNames(appNames);
        setSelectedAppCount(result.selectedCount);

        // Only add trigger if not already present
        setSelectedTriggers((prev) => {
          if (!prev.includes(TriggerType.APP_OPENED)) {
            return [...prev, TriggerType.APP_OPENED];
          }
          return prev;
        });

        console.log('[CreateReminder] Apps selected with IDs:', appIds);

        // Show success message
        Alert.alert(
          '✓ Apps Selected',
          `${result.selectedCount} app(s) added to the reminder. The reminder will fire when any of them are opened.`,
          [{ text: 'OK' }]
        );
      } else if (result === null) {
        // User cancelled - don't show error
        console.log('[CreateReminder] User cancelled app selection');
      }
    } catch (error: any) {
      console.error('[CreateReminder] Failed to show app picker:', error);

      // Check if it's a module not available error
      if (error.message?.includes('not available') || screenTime.error) {
        Alert.alert(
          'Feature Not Available',
          'Screen Time monitoring requires native iOS modules. Please build the app using Xcode:\n\n1. Open ios/until.xcworkspace in Xcode\n2. Build and run on your device\n\nOr use: npm run run:ios:device',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to show app picker. Please try again.');
      }
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
      console.error('[CreateReminder] Failed to save location:', error);
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
    if (selectedTriggers.includes(TriggerType.APP_OPENED) && selectedAppIds.length === 0) {
      Alert.alert('Error', 'Please select an app to monitor for the app trigger');
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

      console.log('[CreateReminder] ========================================');
      console.log('[CreateReminder] Creating reminder with activation settings:');
      console.log('[CreateReminder]   activationDate:', activationDate);
      console.log('[CreateReminder]   activationTime:', activationTime);
      console.log('[CreateReminder]   calculated activationDateTime:', activationDateTime);
      if (activationDateTime) {
        console.log('[CreateReminder]   activationDateTime (readable):', new Date(activationDateTime).toLocaleString());
      }
      console.log('[CreateReminder] ========================================');

      // Create reminder first to get its ID
      const reminder = createReminder(title.trim(), [], [], description.trim());

      // Create triggers with config for APP_OPENED, LOCATION_ENTER, and SCHEDULED_TIME
      // For APP_OPENED, we use the global app ID for precise matching
      const triggers = selectedTriggers.flatMap((type) => {
        if (type === TriggerType.APP_OPENED) {
          return selectedAppIds.map((appId, index) => createTrigger(
            type,
            {
              appId: appId,
              displayName: selectedAppNames[index] || 'Selected App',
            },
            activationDateTime
          ));
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

      // Update reminder with triggers
      reminder.triggers = triggers;

      console.log('[CreateReminder] Created triggers:');
      triggers.forEach((trigger, index) => {
        console.log(`[CreateReminder]   Trigger ${index + 1}:`);
        console.log(`[CreateReminder]     type: ${trigger.type}`);
        console.log(`[CreateReminder]     activationDateTime: ${trigger.activationDateTime}`);
        if (trigger.activationDateTime) {
          console.log(`[CreateReminder]     activationDateTime (readable): ${new Date(trigger.activationDateTime).toLocaleString()}`);
        }
        if (trigger.type === TriggerType.APP_OPENED) {
          const config = trigger.config as { appId?: string; displayName?: string };
          console.log(`[CreateReminder]     appId: ${config.appId}`);
        }
      });

      // Save to store (which persists to database)
      await addReminder(reminder);

      // Start global app monitoring if APP_OPENED triggers exist
      if (selectedTriggers.includes(TriggerType.APP_OPENED)) {
        console.log('=================================================');
        console.log('[CreateReminder] 📱 Setting up Global App Monitoring');
        console.log('[CreateReminder] Reminder ID:', reminder.id);
        console.log('[CreateReminder] Reminder title:', reminder.title);
        console.log('[CreateReminder] App IDs:', selectedAppIds);

        // Import global monitoring functions
        const { startGlobalAppMonitoring, stopGlobalAppMonitoring, getGlobalAppCount } =
          await import('@/app/src/native-bridge/ScreenTimeBridge');

        // Stop existing global monitoring first
        console.log('[CreateReminder] 🛑 Stopping existing global monitoring...');
        await stopGlobalAppMonitoring();

        // Check how many apps are in the library
        const appCount = await getGlobalAppCount();
        console.log(`[CreateReminder] Global library contains ${appCount} app(s)`);

        // Start global monitoring for ALL apps in the library
        console.log('[CreateReminder] 🔄 Starting global app monitoring for all library apps...');
        const success = await startGlobalAppMonitoring();

        if (success) {
          console.log(`[CreateReminder] ✅ Global monitoring started successfully!`);
          console.log(`[CreateReminder] Monitoring ${appCount} app(s) with ONE session`);

          // Check extension status
          const { checkExtensionStatus } = await import('@/app/src/native-bridge/ScreenTimeBridge');
          const extensionStatus = await checkExtensionStatus();

          console.log('[CreateReminder] 🔍 Checking DeviceActivityMonitor extension...');
          console.log('[CreateReminder] Extension status:', JSON.stringify(extensionStatus, null, 2));

          if (!extensionStatus.alive) {
            console.error('[CreateReminder] ❌ WARNING: DeviceActivityMonitor extension is NOT running!');
          } else {
            console.log('[CreateReminder] ✅ Extension is alive and communicating via App Group');
          }
        } else {
          console.error(`[CreateReminder] ❌ FAILED to start global monitoring!`);
        }
        console.log('=================================================');
      }

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
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.cancelButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel, go back"
          >
            <MaterialIcons name="close" size={24} color={WarmColors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} allowFontScaling={false}>New Reminder</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>What do you want to remember?</Text>
                <TextInput
                  style={styles.titleInput}
                  placeholder="e.g., Call mom, Buy groceries"
                  value={title}
                  onChangeText={setTitle}
                  returnKeyType="next"
                  maxLength={100}
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
                  maxLength={500}
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
                  const isAppTriggerUnavailable = isAppTrigger && screenTime.authStatus === 'unknown';

                  return (
                    <TouchableOpacity
                      key={option.type}
                      style={[
                        styles.triggerOption,
                        isSelected && styles.triggerOptionSelected,
                        isLocked && styles.triggerOptionLocked,
                        isAppTriggerUnavailable && styles.triggerOptionUnavailable,
                      ]}
                      onPress={() => toggleTrigger(option.type, option.isPro)}
                      activeOpacity={0.7}
                      disabled={screenTime.isLoading || isAppTriggerUnavailable}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${option.label}${isLocked ? ', Pro feature' : ''}${isAppTriggerUnavailable ? ', not available' : ''}`}
                      accessibilityState={{ checked: isSelected, disabled: screenTime.isLoading || isAppTriggerUnavailable }}
                    >
                      <View style={styles.triggerLeft}>
                        <View style={[styles.triggerIconContainer, isSelected && styles.triggerIconContainerSelected]}>
                          <MaterialIcons
                            name={option.icon}
                            size={18}
                            color={isSelected ? WarmColors.textOnPrimary : WarmColors.primary}
                          />
                        </View>
                        <View style={styles.triggerTextContainer}>
                          <Text style={styles.triggerLabel}>{option.label}</Text>
                          {showAppCount && (
                            <View style={styles.selectedInfoContainer}>
                              <MaterialIcons name="check-circle" size={12} color={WarmColors.success} />
                              <Text style={styles.selectedAppLabel}>
                                {selectedAppCount} {selectedAppCount === 1 ? 'app' : 'apps'} selected · Tap to change
                              </Text>
                            </View>
                          )}
                          {showLocationInfo && (
                            <View style={styles.selectedInfoContainer}>
                              <MaterialIcons name="location-on" size={12} color={WarmColors.primary} />
                              <Text style={styles.selectedAppLabel}>
                                {selectedLocation.name} ({selectedLocation.radius}m)
                              </Text>
                            </View>
                          )}
                          {showScheduledTime && (
                            <View style={styles.selectedInfoContainer}>
                              <MaterialIcons name="schedule" size={12} color={WarmColors.primary} />
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
                            </View>
                          )}
                          {isAppTriggerUnavailable && (
                            <View style={styles.selectedInfoContainer}>
                              <MaterialIcons name="warning" size={12} color={WarmColors.warning} />
                              <Text style={styles.unavailableLabel}>
                                Requires native build (build with Xcode)
                              </Text>
                            </View>
                          )}
                          {isLocked && !isAppTriggerUnavailable && (
                            <View style={styles.selectedInfoContainer}>
                              <MaterialIcons name="lock" size={12} color={WarmColors.accent} />
                              <Text style={styles.proLabel}>Pro Feature</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.triggerRight}>
                        {screenTime.isLoading && isAppTrigger ? (
                          <ActivityIndicator size="small" color={WarmColors.primary} />
                        ) : isLocked ? (
                          <MaterialIcons name="lock" size={20} color={WarmColors.textTertiary} />
                        ) : (
                          <View
                            style={[
                              styles.checkbox,
                              isSelected && styles.checkboxSelected,
                            ]}
                          >
                            {isSelected && (
                              <MaterialIcons name="check" size={16} color={WarmColors.textOnPrimary} />
                            )}
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
                        activeOpacity={0.7}
                      >
                        <View style={styles.activationTimeIconContainer}>
                          <MaterialIcons name="calendar-today" size={20} color={WarmColors.primary} />
                        </View>
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
                        activeOpacity={0.7}
                      >
                        <View style={styles.activationTimeIconContainer}>
                          <MaterialIcons name="access-time" size={20} color={WarmColors.primary} />
                        </View>
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

        {/* Bottom Create Button */}
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={[styles.createButton, isCreating && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={isCreating}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isCreating ? 'Creating reminder, please wait' : 'Create reminder'}
            accessibilityState={{ disabled: isCreating }}
          >
            {isCreating ? (
              <>
                <ActivityIndicator color={WarmColors.textOnPrimary} size="small" />
                <Text style={styles.createButtonText} allowFontScaling={false}>Creating...</Text>
              </>
            ) : (
              <Text style={styles.createButtonText} allowFontScaling={false}>Create Reminder</Text>
            )}
          </TouchableOpacity>
        </View>
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
    backgroundColor: WarmColors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.compact.md,
    paddingTop: 60,
    paddingBottom: Spacing.compact.md,
    backgroundColor: WarmColors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: WarmColors.borderLight,
    ...Elevation.level1,
  },
  cancelButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h4,
    color: WarmColors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: WarmColors.background,
    padding: Spacing.md,
    marginTop: Spacing.compact.md,
  },
  sectionLabel: {
    ...Typography.h4,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.compact.md,
    letterSpacing: -0.3,
  },
  optional: {
    ...Typography.tiny,
    color: WarmColors.textTertiary,
    fontWeight: '400',
    textTransform: 'uppercase',
  },
  sectionHint: {
    ...Typography.tiny,
    color: WarmColors.textSecondary,
    marginBottom: Spacing.compact.md,
    lineHeight: 16,
  },
  titleInput: {
    ...Typography.body,
    color: WarmColors.textPrimary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: WarmColors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 0.5,
    borderColor: WarmColors.borderLight,
  },
  descriptionInput: {
    ...Typography.body,
    color: WarmColors.textPrimary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: WarmColors.surface,
    borderRadius: BorderRadius.md,
    minHeight: 80,
    borderWidth: 0.5,
    borderColor: WarmColors.borderLight,
  },
  triggerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.compact.md,
    backgroundColor: WarmColors.surface,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.compact.md,
    borderWidth: 0.5,
    borderColor: WarmColors.borderLight,
    ...Elevation.level1,
  },
  triggerOptionSelected: {
    backgroundColor: `${WarmColors.primary}08`,
    borderColor: WarmColors.primary,
    borderWidth: 1.5,
  },
  triggerOptionLocked: {
    opacity: 0.6,
  },
  triggerOptionUnavailable: {
    opacity: 0.5,
    backgroundColor: WarmColors.surfaceVariant,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  triggerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${WarmColors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.compact.sm + 2,
  },
  triggerIconContainerSelected: {
    backgroundColor: WarmColors.primary,
  },
  triggerTextContainer: {
    flex: 1,
  },
  triggerLabel: {
    ...Typography.cardTitle,
    color: WarmColors.textPrimary,
  },
  selectedInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.compact.xs,
    gap: 4,
  },
  proLabel: {
    ...Typography.tiny,
    color: WarmColors.accent,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  selectedAppLabel: {
    ...Typography.tiny,
    color: WarmColors.primary,
    fontWeight: '600',
  },
  unavailableLabel: {
    ...Typography.tiny,
    color: WarmColors.warning,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  triggerRight: {
    marginLeft: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: WarmColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: WarmColors.primary,
    borderColor: WarmColors.primary,
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
    backgroundColor: WarmColors.overlay,
  },
  datePickerModal: {
    backgroundColor: WarmColors.background,
    borderRadius: BorderRadius.lg,
    width: '85%',
    ...Elevation.level5,
    overflow: 'hidden',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: WarmColors.border,
  },
  datePickerTitle: {
    ...Typography.h4,
    color: WarmColors.textPrimary,
  },
  datePickerClose: {
    fontSize: 24,
    color: WarmColors.textTertiary,
    fontWeight: '300',
  },
  datePickerButtons: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: WarmColors.border,
  },
  datePickerCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    backgroundColor: WarmColors.surfaceVariant,
    alignItems: 'center',
  },
  datePickerCancelText: {
    ...Typography.bodyBold,
    color: WarmColors.textSecondary,
  },
  datePickerConfirmButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    backgroundColor: WarmColors.primary,
    alignItems: 'center',
  },
  datePickerConfirmText: {
    ...Typography.bodyBold,
    color: WarmColors.textOnPrimary,
  },
  // Activation Time Styles
  activationTimeContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  activationTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: WarmColors.surfaceVariant,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: WarmColors.border,
    ...Elevation.level1,
  },
  activationTimeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${WarmColors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  activationTimeButtonText: {
    flex: 1,
  },
  activationTimeLabel: {
    ...Typography.small,
    color: WarmColors.textSecondary,
    marginBottom: 4,
  },
  activationTimeValue: {
    ...Typography.bodyBold,
    color: WarmColors.textPrimary,
  },
  clearActivationButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  clearActivationText: {
    ...Typography.caption,
    color: WarmColors.error,
    fontWeight: '600',
  },
  // Bottom Button
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md + 20, // Extra padding for safe area
    backgroundColor: WarmColors.background,
    borderTopWidth: 0.5,
    borderTopColor: WarmColors.borderLight,
    ...Elevation.level3,
  },
  createButton: {
    backgroundColor: WarmColors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    ...Elevation.level2,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    ...Typography.bodyBold,
    color: WarmColors.textOnPrimary,
    fontSize: 17,
  },
});
