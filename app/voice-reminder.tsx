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
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  addSpeechRecognitionListener,
} from '@jamsch/expo-speech-recognition';
import { parseVoiceReminder, getTriggerDescription, getActivationDescription } from '@/app/src/utils/ReminderParser';
import type { ParsedReminder, ParsedTrigger } from '@/app/src/utils/ReminderParser';
import { useReminderStore } from '@/app/src/store/reminderStore';
import { createReminder, createTrigger, TriggerType } from '@/app/src/domain';

export default function VoiceReminderScreen() {
  const router = useRouter();
  const { addReminder, getSavedPlaceById, savedPlaces } = useReminderStore();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedReminder, setParsedReminder] = useState<ParsedReminder | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        console.error('[VoiceReminder] Parse error:', err);
        setError('Could not understand that. Please try again.');
      }
    }
  });

  // Listen for errors
  useSpeechRecognitionEvent('error', (event) => {
    console.error('[VoiceReminder] Speech recognition error:', event.error);
    setIsListening(false);

    if (event.error === 'no-speech') {
      setError('No speech detected. Please try again.');
    } else if (event.error === 'audio') {
      setError('Microphone error. Please check permissions.');
    } else {
      setError('Speech recognition error. Please try again.');
    }
  });

  // Listen for end of speech
  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  const startListening = async () => {
    try {
      // Check if speech recognition is supported
      const androidRecognitionAvailable = await ExpoSpeechRecognitionModule.androidRecognitionAvailable?.();
      const iosRecognitionAvailable = await ExpoSpeechRecognitionModule.iosRecognitionAvailable?.();

      console.log('[VoiceReminder] Recognition available:', { androidRecognitionAvailable, iosRecognitionAvailable });

      // Start speech recognition (permissions will be requested automatically)
      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        requiresOnDeviceRecognition: false,
      });

      setIsListening(true);
      setTranscript('');
      setParsedReminder(null);
      setError(null);
    } catch (err: any) {
      console.error('[VoiceReminder] Failed to start speech recognition:', err);

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
    } catch (err) {
      console.error('[VoiceReminder] Failed to stop speech recognition:', err);
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

    // Location not found - show alert
    Alert.alert(
      'Location Not Found',
      `I couldn't find "${trigger.locationQuery}" in your saved places. Please add it manually.`,
      [{ text: 'OK' }]
    );

    return null;
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
          // For MVP, skip app triggers (need app selection UI)
          Alert.alert(
            'App Trigger Not Supported Yet',
            'App-based triggers will be available in a future update. Your reminder will be created without this trigger.',
            [{ text: 'OK' }]
          );
          continue;
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
      console.error('[VoiceReminder] Failed to create reminder:', err);
      Alert.alert('Error', 'Failed to create reminder. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Reminder</Text>
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
            <Text style={styles.exampleText}>• "Remind me to buy milk at the store"</Text>
            <Text style={styles.exampleText}>• "Call mom tomorrow at 3pm"</Text>
            <Text style={styles.exampleText}>• "Take medicine when I plug in my phone"</Text>
          </View>
        )}

        {/* Microphone Button */}
        <View style={styles.micContainer}>
          <TouchableOpacity
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPress={isListening ? stopListening : startListening}
            disabled={isCreating}
          >
            <Text style={styles.micIcon}>{isListening ? '🔴' : '🎤'}</Text>
          </TouchableOpacity>
          <Text style={styles.micHint}>
            {isListening ? 'Listening... Tap to stop' : 'Tap to start recording'}
          </Text>
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
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
                    <Text style={styles.triggerBullet}>•</Text>
                    <Text style={styles.triggerText}>
                      {getTriggerDescription(trigger)}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {parsedReminder.confidence < 0.7 && (
              <View style={styles.lowConfidenceWarning}>
                <Text style={styles.lowConfidenceText}>
                  ⚠️ I'm not entirely sure I understood correctly. Please review before creating.
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
            >
              {isCreating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>Create Reminder</Text>
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
    width: 80,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  instructionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    marginTop: 8,
  },
  exampleText: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  micContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  micButtonActive: {
    backgroundColor: '#FF3B30',
  },
  micIcon: {
    fontSize: 48,
  },
  micHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
    textAlign: 'center',
  },
  transcriptContainer: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  transcriptLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  transcript: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
  },
  parsedContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  parsedLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  parsedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  triggersLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 8,
  },
  triggerItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  triggerBullet: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 8,
    marginTop: 2,
  },
  triggerText: {
    fontSize: 14,
    color: '#007AFF',
    flex: 1,
  },
  lowConfidenceWarning: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  lowConfidenceText: {
    fontSize: 12,
    color: '#856404',
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  noTriggersHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
