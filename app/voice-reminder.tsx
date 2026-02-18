/**
 * Voice Reminder Screen
 * Allows users to create reminders using voice commands
 * MVP: In-app voice recording with local parsing
 */

import { useEffect, useState } from 'react';
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
import { createReminder, createTrigger, TriggerType } from '@/app/src/domain';
import { WarmColors, Elevation, Spacing, BorderRadius, Typography } from '@/constants/theme';

export default function VoiceReminderScreen() {
  const router = useRouter();
  const { addReminder, getSavedPlaceById, savedPlaces } = useReminderStore();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedReminder, setParsedReminder] = useState<ParsedReminder | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

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

    // 'no-speech' is very common (silence / background noise) — keep any existing
    // transcript/draft intact and show a soft, non-blocking message
    if (event.error === 'no-speech') {
      // Only show the hint if the user hasn't already captured something
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
    // Reset all state immediately before any async work so UI is clean
    setTranscript('');
    setParsedReminder(null);
    setError(null);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);

    try {
      // Always stop any previous session first to avoid "already running" errors
      try {
        await ExpoSpeechRecognitionModule.stop();
      } catch {
        // Ignore — it may not have been running
      }

      // Check network connectivity (speech recognition requires network)
      const { checkNetworkConnectivity } = await import('@/app/src/utils/NetworkUtils');
      const isOnline = await checkNetworkConnectivity();
      if (!isOnline) {
        setError('No internet connection. Voice reminders require network access for speech recognition.');
        return;
      }

      // These debug checks are removed as the methods don't exist on ExpoSpeechRecognitionModule
      // The module will handle platform-specific availability checks internally

      // Start speech recognition (permissions will be requested automatically)
      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        requiresOnDeviceRecognition: false,
      });

      setIsListening(true);

      // Start pulse animation
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

      // Handle permission errors
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

  const resolveLocationTrigger = async (trigger: ParsedTrigger): Promise<any> => {
    if (!trigger.locationQuery) {
      return null;
    }

    // Search saved places for match
    const query = trigger.locationQuery.toLowerCase();
    const matchedPlace = savedPlaces.find((place) =>
      place.name.toLowerCase().includes(query)
    );

    if (matchedPlace) {
      return createTrigger(
        TriggerType.LOCATION_ENTER,
        {
          latitude: matchedPlace.latitude,
          longitude: matchedPlace.longitude,
          radius: matchedPlace.radius,
          name: matchedPlace.name,
        },
        trigger.activationDateTime
      );
    }

    // Location not found - create placeholder that user can edit later
    if (__DEV__) console.log(`[VoiceReminder] Location "${trigger.locationQuery}" not found, creating placeholder`);
    return createTrigger(
      TriggerType.LOCATION_ENTER,
      {
        latitude: 0,
        longitude: 0,
        radius: 100,
        name: `${trigger.locationQuery} (Edit location)`,
      },
      trigger.activationDateTime
    );
  };

  const createReminderFromVoice = async () => {
    if (!parsedReminder || !parsedReminder.title) {
      Alert.alert('Error', 'Please speak a reminder first');
      return;
    }

    setIsCreating(true);

    try {
      const triggers = [];

      // Resolve triggers
      for (const parsedTrigger of parsedReminder.triggers) {
        if (parsedTrigger.type === TriggerType.LOCATION_ENTER) {
          const trigger = await resolveLocationTrigger(parsedTrigger);
          if (trigger) {
            triggers.push(trigger);
          } else {
            // Location couldn't be resolved - skip this trigger
            continue;
          }
        } else if (parsedTrigger.type === TriggerType.APP_OPENED) {
          // Create placeholder app trigger - user can select actual app later
          if (__DEV__) console.log(`[VoiceReminder] Creating placeholder app trigger for "${parsedTrigger.appQuery}"`);
          triggers.push(
            createTrigger(
              TriggerType.APP_OPENED,
              {
                appId: 'unknown',
                displayName: `${parsedTrigger.appQuery || 'Unknown App'} (Select app)`,
              },
              parsedTrigger.activationDateTime
            )
          );
        } else {
          // Other triggers (scheduled time, charging, unlock)
          triggers.push(
            createTrigger(
              parsedTrigger.type,
              parsedTrigger.config || null,
              parsedTrigger.activationDateTime
            )
          );
        }
      }

      // Must have at least one trigger
      if (triggers.length === 0) {
        Alert.alert(
          'No Triggers',
          'Please specify when you want to be reminded (e.g., "tomorrow at 3pm", "when I get home")',
          [{ text: 'OK' }]
        );
        setIsCreating(false);
        return;
      }

      // Create reminder
      const reminder = createReminder(
        parsedReminder.title,
        triggers,
        [] // No conditions for MVP
      );

      await addReminder(reminder);

      // Navigate back with success message
      router.dismissAll();
      router.replace('/(tabs)?message=Voice reminder created!' as any);
    } catch (err) {
      if (__DEV__) console.error('[VoiceReminder] Failed to create reminder:', err);
      Alert.alert('Error', 'Failed to create reminder. Please try again.');
    } finally {
      setIsCreating(false);
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
                {parsedReminder.triggers.map((trigger, idx) => (
                  <View key={idx} style={styles.triggerItem}>
                    <MaterialIcons name="check-circle" size={16} color={WarmColors.primary} />
                    <Text style={styles.triggerText}>
                      {getTriggerDescription(trigger)}
                    </Text>
                  </View>
                ))}
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

            {/* Create button */}
            <TouchableOpacity
              style={[
                styles.createButton,
                (isCreating || parsedReminder.triggers.length === 0) && styles.createButtonDisabled,
              ]}
              onPress={createReminderFromVoice}
              disabled={isCreating || parsedReminder.triggers.length === 0}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isCreating ? 'Creating reminder' : 'Create reminder from voice'}
              accessibilityState={{ disabled: isCreating || parsedReminder.triggers.length === 0 }}
            >
              {isCreating ? (
                <ActivityIndicator color={WarmColors.textOnPrimary} />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={20} color={WarmColors.textOnPrimary} />
                  <Text style={styles.createButtonText}>Create Reminder</Text>
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
});
