/**
 * Voice Reminder Screen
 * Allows users to create reminders using voice commands
 * MVP: In-app voice recording with local parsing
 */

import { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  addSpeechRecognitionListener,
} from '@jamsch/expo-speech-recognition';
import { parseVoiceReminder, getTriggerDescription, getActivationDescription } from '@/app/src/utils/ReminderParser';
import type { ParsedReminder, ParsedTrigger } from '@/app/src/utils/ReminderParser';
import { useReminderStore } from '@/app/src/store/reminderStore';
import { useScreenTime } from '@/app/src/hooks/useScreenTime';
import { createReminder, createTrigger, createSavedPlace, TriggerType, LocationConfig, SavedPlace } from '@/app/src/domain';
import SavedPlacesList from '@/app/src/ui/SavedPlacesList';
import MapPicker from '@/app/src/ui/MapPicker';
import { WarmColors, Elevation, Spacing, BorderRadius, Typography } from '@/constants/theme';

export default function VoiceReminderScreen() {
  const router = useRouter();
  const { addReminder, savedPlaces, addSavedPlace, incrementPlaceUsage } = useReminderStore();
  const screenTime = useScreenTime();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedReminder, setParsedReminder] = useState<ParsedReminder | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Resolution queue state
  // FIX: Use refs for queue state to avoid stale closure issues in Alert callbacks
  const pendingQueueRef = useRef<ParsedTrigger[]>([]);
  const queueIndexRef = useRef(-1);
  const resolvedTriggersRef = useRef<any[]>([]);
  const directTriggersRef = useRef<any[]>([]);

  // UI state for triggering re-renders
  const [pendingQueue, setPendingQueue] = useState<ParsedTrigger[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [resolvedTriggers, setResolvedTriggers] = useState<any[]>([]);
  const [directTriggers, setDirectTriggers] = useState<any[]>([]);

  // Location modal state
  const [showSavedPlacesList, setShowSavedPlacesList] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // FIX: Keep refs in sync with state
  useEffect(() => {
    pendingQueueRef.current = pendingQueue;
  }, [pendingQueue]);

  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);

  useEffect(() => {
    resolvedTriggersRef.current = resolvedTriggers;
  }, [resolvedTriggers]);

  useEffect(() => {
    directTriggersRef.current = directTriggers;
  }, [directTriggers]);

  // Reset all voice state on mount so returning to this screen starts fresh
  useEffect(() => {
    setTranscript('');
    setParsedReminder(null);
    setError(null);
    setIsListening(false);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, []);

  // Derived: whether any parsed trigger needs user input to resolve
  const hasUnresolvedTriggers = parsedReminder?.triggers.some(
    (t) =>
      (t.type === TriggerType.LOCATION_ENTER &&
        !savedPlaces.some((p) =>
          p.name.toLowerCase().includes((t.locationQuery || '').toLowerCase())
        )) ||
      t.type === TriggerType.APP_OPENED
  ) ?? false;

  // Listen for speech recognition results
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript || '';
    setTranscript(text);

    // Parse in real-time if text is substantial
    if (text.length > 5) {
      try {
        const parsed = parseVoiceReminder(text);
        setParsedReminder(parsed);
        setError(null);
      } catch (err) {
        if (__DEV__) console.error('[VoiceReminder] Parse error:', err);
        setError('Could not understand that. Please try again.');
      }
    }
  });

  // Listen for errors
  useSpeechRecognitionEvent('error', (event) => {
    if (__DEV__) console.warn('[VoiceReminder] Speech recognition error:', event.error);
    setIsListening(false);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);

    if (event.error === 'no-speech') {
      setError('No speech detected — tap the mic and speak clearly.');
    } else if (event.error === 'audio-capture') {
      setError('Microphone error. Please check permissions.');
    } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      setError('Microphone permission denied. Please enable it in Settings.');
    } else {
      setError('Speech recognition error. Please try again.');
    }
  });

  // Listen for end of speech
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  });

  const startListening = async () => {
    setTranscript('');
    setParsedReminder(null);
    setError(null);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);

    try {
      try {
        await ExpoSpeechRecognitionModule.stop();
      } catch {
        // Ignore — it may not have been running
      }

      const { checkNetworkConnectivity } = await import('@/app/src/utils/NetworkUtils');
      const isOnline = await checkNetworkConnectivity();
      if (!isOnline) {
        setError('No internet connection. Voice reminders require network access for speech recognition.');
        return;
      }

      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        requiresOnDeviceRecognition: false,
      });

      setIsListening(true);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } catch (err: any) {
      if (__DEV__) console.error('[VoiceReminder] Failed to start speech recognition:', err);
      setIsListening(false);

      if (err.message?.includes('permission') || err.message?.includes('denied')) {
        Alert.alert(
          'Permission Required',
          'Please allow microphone and speech recognition access in Settings to use voice reminders.',
          [{ text: 'OK' }]
        );
      } else {
        setError('Failed to start voice recording. Please try again.');
      }
    }
  };

  const stopListening = async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    } catch (err) {
      if (__DEV__) console.error('[VoiceReminder] Failed to stop speech recognition:', err);
    }
  };

  // Reset the entire resolution queue (used when user cancels mid-flow)
  const resetQueue = () => {
    setPendingQueue([]);
    setQueueIndex(-1);
    setResolvedTriggers([]);
    setDirectTriggers([]);
    // FIX: Also reset refs
    pendingQueueRef.current = [];
    queueIndexRef.current = -1;
    resolvedTriggersRef.current = [];
    directTriggersRef.current = [];
  };

  // Final step: create and persist the reminder with all resolved triggers
  const finalizeReminder = async (allTriggers: any[]) => {
    if (allTriggers.length === 0) {
      Alert.alert(
        'No Triggers',
        'Please specify when you want to be reminded (e.g., "tomorrow at 3pm", "when I get home")',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsCreating(true);
    try {
      const reminder = createReminder(parsedReminder!.title, allTriggers, []);
      await addReminder(reminder);
      router.dismissAll();
      router.replace('/(tabs)?message=Voice reminder created!' as any);
    } catch (err) {
      if (__DEV__) console.error('[VoiceReminder] Failed to create reminder:', err);
      Alert.alert('Error', 'Failed to create reminder. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Advance to the next item in the resolution queue (or finalize if done)
  // FIX: Use refs directly to get current values and avoid stale closures in Alert callbacks
  const advanceResolutionQueue = (resolvedTrigger: any) => {
    const currentResolved = resolvedTriggersRef.current;
    const currentDirect = directTriggersRef.current;
    const queue = pendingQueueRef.current;
    const idx = queueIndexRef.current;

    const nextResolved = [...currentResolved, resolvedTrigger];
    const nextIdx = idx + 1;

    // Update refs immediately
    resolvedTriggersRef.current = nextResolved;
    queueIndexRef.current = nextIdx;

    // Update state for UI
    setResolvedTriggers(nextResolved);
    setQueueIndex(nextIdx);

    if (nextIdx < queue.length) {
      startResolvingTrigger(queue[nextIdx]);
    } else {
      finalizeReminder([...currentDirect, ...nextResolved]);
      resetQueue();
    }
  };

  // Dispatch to the correct modal/flow for a given pending trigger
  const startResolvingTrigger = (trigger: ParsedTrigger) => {
    if (trigger.type === TriggerType.LOCATION_ENTER) {
      setShowSavedPlacesList(true);
    } else if (trigger.type === TriggerType.APP_OPENED) {
      handleAppTriggerResolution(trigger);
    }
  };

  // Entry point when user taps Create / Select Trigger Details
  const handleCreateTapped = () => {
    if (!parsedReminder || !parsedReminder.title) {
      Alert.alert('Error', 'Please speak a reminder first');
      return;
    }

    const direct: any[] = [];
    const pending: ParsedTrigger[] = [];

    for (const parsedTrigger of parsedReminder.triggers) {
      if (parsedTrigger.type === TriggerType.LOCATION_ENTER) {
        const query = (parsedTrigger.locationQuery || '').toLowerCase();
        const matched = savedPlaces.find((p) => p.name.toLowerCase().includes(query));
        if (matched) {
          direct.push(
            createTrigger(
              TriggerType.LOCATION_ENTER,
              {
                latitude: matched.latitude,
                longitude: matched.longitude,
                radius: matched.radius,
                name: matched.name,
              },
              parsedTrigger.activationDateTime
            )
          );
        } else {
          pending.push(parsedTrigger);
        }
      } else if (parsedTrigger.type === TriggerType.APP_OPENED) {
        // App triggers always need user to pick via FamilyActivityPicker
        pending.push(parsedTrigger);
      } else {
        // SCHEDULED_TIME, CHARGING_STARTED, PHONE_UNLOCK — resolve immediately
        direct.push(
          createTrigger(
            parsedTrigger.type,
            parsedTrigger.config || null,
            parsedTrigger.activationDateTime
          )
        );
      }
    }

    if (pending.length === 0) {
      // All triggers auto-resolved — create immediately
      finalizeReminder(direct);
      return;
    }

    // Start sequential resolution
    // FIX: Also update refs when starting the queue
    directTriggersRef.current = direct;
    resolvedTriggersRef.current = [];
    pendingQueueRef.current = pending;
    queueIndexRef.current = 0;

    setDirectTriggers(direct);
    setResolvedTriggers([]);
    setPendingQueue(pending);
    setQueueIndex(0);
    startResolvingTrigger(pending[0]);
  };

  // --- Location handlers ---

  const handleSelectSavedPlace = async (place: SavedPlace) => {
    setShowSavedPlacesList(false);
    const currentParsedTrigger = pendingQueueRef.current[queueIndexRef.current];
    const resolvedTrigger = createTrigger(
      TriggerType.LOCATION_ENTER,
      {
        latitude: place.latitude,
        longitude: place.longitude,
        radius: place.radius,
        name: place.name,
      },
      currentParsedTrigger?.activationDateTime
    );
    await incrementPlaceUsage(place.id);
    advanceResolutionQueue(resolvedTrigger);
  };

  const handleAddNewPlace = () => {
    setShowSavedPlacesList(false);
    setShowMapPicker(true);
  };

  const handleMapPickerSave = async (location: LocationConfig & { name: string }) => {
    try {
      const newPlace = createSavedPlace(
        location.name,
        location.latitude,
        location.longitude,
        location.radius
      );
      await addSavedPlace(newPlace);
      const currentParsedTrigger = pendingQueueRef.current[queueIndexRef.current];
      const resolvedTrigger = createTrigger(
        TriggerType.LOCATION_ENTER,
        { ...location },
        currentParsedTrigger?.activationDateTime
      );
      setShowMapPicker(false);
      advanceResolutionQueue(resolvedTrigger);
    } catch (err) {
      if (__DEV__) console.error('[VoiceReminder] Failed to save location:', err);
      Alert.alert('Error', 'Failed to save location. Please try again.');
    }
  };

  const handleMapPickerCancel = () => {
    setShowMapPicker(false);
    setShowSavedPlacesList(true);
  };

  // --- App trigger handlers ---

  const handleAppTriggerResolution = async (parsedTrigger: ParsedTrigger) => {
    if (screenTime.isLoading) return;

    if (screenTime.authStatus === 'unknown' && screenTime.error) {
      Alert.alert(
        'Feature Not Available',
        'Screen Time monitoring is not available on this device. This feature requires native iOS modules that need to be built with Xcode.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!screenTime.isAuthorized) {
      Alert.alert(
        'Screen Time Permission Required',
        'Until needs Screen Time permission to detect when you open specific apps. You will choose which apps to monitor.',
        [
          { text: 'Cancel', style: 'cancel', onPress: resetQueue },
          {
            text: 'Continue',
            onPress: async () => {
              try {
                const status = await screenTime.requestPermission();
                if (status === 'approved') {
                  await showAppPickerForVoice(parsedTrigger);
                } else {
                  Alert.alert(
                    'Permission Denied',
                    'Screen Time permission is required for app-based reminders. Please enable it in Settings.',
                    [{ text: 'OK' }]
                  );
                  resetQueue();
                }
              } catch (err: any) {
                if (__DEV__) console.error('[VoiceReminder] Permission request failed:', err);
                Alert.alert('Error', err.message || 'Failed to request Screen Time permission.');
                resetQueue();
              }
            },
          },
        ]
      );
      return;
    }

    await showAppPickerForVoice(parsedTrigger);
  };

  const showAppPickerForVoice = async (parsedTrigger: ParsedTrigger) => {
    // FIX: No longer need to capture state - we use refs now which always have current values

    try {
      const result = await screenTime.showAppPicker();

      if (result && result.selectedCount > 0) {
        const timestamp = Date.now();
        const appIds = Array.from({ length: result.selectedCount }, (_, i) => `app_${timestamp}_${i}`);

        const { addAppsToLibrary, startGlobalAppMonitoring, stopGlobalAppMonitoring } =
          await import('@/app/src/native-bridge/ScreenTimeBridge');

        const success = await addAppsToLibrary(appIds);
        if (!success) throw new Error('Failed to add apps to global library');

        // Restart global monitoring to include the newly added apps
        await stopGlobalAppMonitoring();
        await startGlobalAppMonitoring();

        const resolvedTrigger = createTrigger(
          TriggerType.APP_OPENED,
          {
            appId: appIds[0],
            displayName: parsedTrigger.appQuery || 'Selected App',
          },
          parsedTrigger.activationDateTime
        );

        Alert.alert(
          'Apps Selected',
          `${result.selectedCount} app(s) added. The reminder will fire when any of them are opened.`,
          [
            {
              text: 'OK',
              // FIX: Use refs instead of captured values - no stale closures
              onPress: () => advanceResolutionQueue(resolvedTrigger),
            },
          ]
        );
      } else if (result === null) {
        // User cancelled
        if (__DEV__) console.log('[VoiceReminder] User cancelled app selection');
        resetQueue();
      }
    } catch (err: any) {
      if (__DEV__) console.error('[VoiceReminder] App picker error:', err);
      if (err.message?.includes('not available') || screenTime.error) {
        Alert.alert(
          'Feature Not Available',
          'Screen Time monitoring requires a native Xcode build.\n\n1. Open ios/until.xcworkspace in Xcode\n2. Build and run on your device',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', err.message || 'Failed to show app picker. Please try again.');
      }
      resetQueue();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={24} color={WarmColors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} allowFontScaling={false}>Voice Reminder</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Instructions */}
        {!transcript && !isListening && (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>Tap to speak</Text>
            <Text style={styles.instructionsText}>
              Try saying:
            </Text>
            <Text style={styles.exampleText}>• &quot;Remind me to buy milk at the store&quot;</Text>
            <Text style={styles.exampleText}>• &quot;Call mom tomorrow at 3pm&quot;</Text>
            <Text style={styles.exampleText}>• &quot;Take medicine when I plug in my phone&quot;</Text>
          </View>
        )}

        {/* Microphone Button */}
        <View style={styles.micContainer}>
          <Animated.View style={{ transform: [{ scale: isListening ? pulseAnim : 1 }] }}>
            <TouchableOpacity
              style={[styles.micButton, isListening && styles.micButtonActive]}
              onPress={isListening ? stopListening : startListening}
              disabled={isCreating}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isListening ? 'Stop voice recording' : 'Start voice recording'}
              accessibilityState={{ disabled: isCreating }}
            >
              <MaterialIcons
                name={isListening ? 'mic' : 'mic-none'}
                size={48}
                color={WarmColors.textOnPrimary}
              />
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.micHint}>
            {isListening ? 'Listening... Tap to stop' : 'Tap to start recording'}
          </Text>
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => setError(null)}
              style={styles.errorDismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
            >
              <MaterialIcons name="close" size={18} color={WarmColors.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* Real-time transcript */}
        {transcript && (
          <View style={styles.transcriptContainer}>
            <Text style={styles.transcriptLabel}>You said:</Text>
            <Text style={styles.transcript}>{transcript}</Text>
          </View>
        )}

        {/* Parsed result */}
        {parsedReminder && parsedReminder.title && (
          <View style={styles.parsedContainer}>
            <Text style={styles.parsedLabel}>I heard:</Text>
            <Text style={styles.parsedTitle}>{parsedReminder.title}</Text>

            {parsedReminder.triggers.length > 0 && (
              <>
                <Text style={styles.triggersLabel}>Triggers:</Text>
                {parsedReminder.triggers.map((trigger, idx) => {
                  const isUnresolved =
                    (trigger.type === TriggerType.LOCATION_ENTER &&
                      !savedPlaces.some((p) =>
                        p.name.toLowerCase().includes((trigger.locationQuery || '').toLowerCase())
                      )) ||
                    trigger.type === TriggerType.APP_OPENED;

                  return (
                    <View key={idx} style={styles.triggerItem}>
                      <MaterialIcons
                        name={isUnresolved ? 'warning' : 'check-circle'}
                        size={16}
                        color={isUnresolved ? WarmColors.warning : WarmColors.primary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.triggerText, isUnresolved && styles.triggerTextUnresolved]}>
                          {getTriggerDescription(trigger)}
                        </Text>
                        {isUnresolved && (
                          <Text style={styles.unresolvedHint}>
                            Tap &quot;Select Trigger Details&quot; to choose
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {parsedReminder.confidence < 0.7 && (
              <View style={styles.lowConfidenceWarning}>
                <MaterialIcons name="warning" size={16} color={WarmColors.warning} />
                <Text style={styles.lowConfidenceText}>
                  I&apos;m not entirely sure I understood correctly. Please review before creating.
                </Text>
              </View>
            )}

            {/* Create / Select Trigger Details button */}
            <TouchableOpacity
              style={[
                styles.createButton,
                (isCreating || parsedReminder.triggers.length === 0) && styles.createButtonDisabled,
              ]}
              onPress={handleCreateTapped}
              disabled={isCreating || parsedReminder.triggers.length === 0}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={
                isCreating
                  ? 'Creating reminder'
                  : hasUnresolvedTriggers
                  ? 'Select trigger details'
                  : 'Create reminder from voice'
              }
              accessibilityState={{ disabled: isCreating || parsedReminder.triggers.length === 0 }}
            >
              {isCreating ? (
                <ActivityIndicator color={WarmColors.textOnPrimary} />
              ) : (
                <>
                  <MaterialIcons
                    name={hasUnresolvedTriggers ? 'touch-app' : 'check-circle'}
                    size={20}
                    color={WarmColors.textOnPrimary}
                  />
                  <Text style={styles.createButtonText}>
                    {hasUnresolvedTriggers ? 'Select Trigger Details' : 'Create Reminder'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {parsedReminder.triggers.length === 0 && (
              <Text style={styles.noTriggersHint}>
                Please specify when you want to be reminded
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Location: SavedPlacesList as full-screen overlay */}
      {showSavedPlacesList && (
        <View style={styles.fullScreenModal}>
          <SavedPlacesList
            onSelectPlace={handleSelectSavedPlace}
            onAddNewPlace={handleAddNewPlace}
          />
          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={() => {
              setShowSavedPlacesList(false);
              resetQueue();
            }}
            accessibilityRole="button"
            accessibilityLabel="Cancel location selection"
          >
            <Text style={styles.closeModalText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Location: MapPicker (has its own Modal internally) */}
      <MapPicker
        visible={showMapPicker}
        onSave={handleMapPickerSave}
        onCancel={handleMapPickerCancel}
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
    width: 80,
    alignItems: 'flex-start',
  },
  backButtonText: {
    ...Typography.body,
    color: WarmColors.primary,
  },
  headerTitle: {
    ...Typography.h4,
    color: WarmColors.textPrimary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
  },
  instructionsContainer: {
    backgroundColor: WarmColors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Elevation.level2,
  },
  instructionsTitle: {
    ...Typography.h3,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.md,
  },
  instructionsText: {
    ...Typography.caption,
    color: WarmColors.textSecondary,
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
  },
  exampleText: {
    ...Typography.caption,
    color: WarmColors.primary,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  micContainer: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: WarmColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.level4,
  },
  micButtonActive: {
    backgroundColor: WarmColors.secondary,
  },
  micHint: {
    ...Typography.caption,
    color: WarmColors.textSecondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: `${WarmColors.error}15`,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorDismiss: {
    marginLeft: 'auto' as const,
    padding: 4,
  },
  errorText: {
    ...Typography.caption,
    color: WarmColors.error,
    textAlign: 'center',
    flex: 1,
  },
  transcriptContainer: {
    backgroundColor: WarmColors.surfaceVariant,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Elevation.level1,
  },
  transcriptLabel: {
    ...Typography.small,
    color: WarmColors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  transcript: {
    ...Typography.body,
    color: WarmColors.textPrimary,
    lineHeight: 24,
  },
  parsedContainer: {
    backgroundColor: WarmColors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Elevation.level3,
  },
  parsedLabel: {
    ...Typography.small,
    color: WarmColors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  parsedTitle: {
    ...Typography.h3,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.md,
  },
  triggersLabel: {
    ...Typography.bodyBold,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  triggerItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  triggerText: {
    ...Typography.body,
    color: WarmColors.primary,
    flex: 1,
  },
  triggerTextUnresolved: {
    color: WarmColors.warning,
  },
  unresolvedHint: {
    ...Typography.small,
    color: WarmColors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  lowConfidenceWarning: {
    backgroundColor: `${WarmColors.warning}20`,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  lowConfidenceText: {
    ...Typography.small,
    color: WarmColors.warning,
    flex: 1,
  },
  createButton: {
    backgroundColor: WarmColors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Elevation.level2,
  },
  createButtonDisabled: {
    backgroundColor: WarmColors.textTertiary,
  },
  createButtonText: {
    ...Typography.bodyBold,
    color: WarmColors.textOnPrimary,
  },
  noTriggersHint: {
    ...Typography.small,
    color: WarmColors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  // Full-screen modal overlay (for SavedPlacesList)
  fullScreenModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: WarmColors.background,
    zIndex: 1000,
  },
  closeModalButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: WarmColors.surfaceVariant,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  closeModalText: {
    ...Typography.bodyBold,
    color: WarmColors.textSecondary,
  },
});
