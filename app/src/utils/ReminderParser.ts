/**
 * Voice Reminder Parser
 * Parses natural language voice transcripts into reminder structure
 * Uses chrono-node for date/time parsing and regex for trigger detection
 */

import * as chrono from 'chrono-node/en';
import { TriggerType } from '../domain/types';

export interface ParsedTrigger {
  type: TriggerType;
  config?: any;
  activationDateTime?: number;
  // For location triggers that need resolution
  locationQuery?: string;
  // For app triggers that need app selection
  appQuery?: string;
}

export interface ParsedReminder {
  title: string;
  triggers: ParsedTrigger[];
  confidence: number; // 0-1, indicates parsing confidence
  rawTranscript: string;
}

/**
 * Parse a voice transcript into a reminder structure
 */
export function parseVoiceReminder(transcript: string): ParsedReminder {
  let text = transcript.toLowerCase().trim();
  const originalText = text;
  const triggers: ParsedTrigger[] = [];
  let confidence = 1.0;

  // Remove common reminder prefixes
  text = text.replace(/^(remind me to|reminder to|remind me|remember to|don't forget to) /i, '');

  // Extract activation time (e.g., "starting tomorrow", "after 3pm")
  let activationTime: number | undefined;
  const activationPatterns = [
    /starting (tomorrow|next week|next month)/i,
    /after (.+?)(,|\.| when| and|$)/i,
    /beginning (.+?)(,|\.| when| and|$)/i,
  ];

  for (const pattern of activationPatterns) {
    const match = text.match(pattern);
    if (match) {
      const activationText = match[1] || match[0];
      const parsed = chrono.parseDate(activationText);
      if (parsed) {
        activationTime = parsed.getTime();
        text = text.replace(match[0], '').trim();
      }
    }
  }

  // Parse date/time with chrono-node
  const dateResults = chrono.parse(text);
  if (dateResults.length > 0) {
    const dateResult = dateResults[0];
    const date = dateResult.start.date();

    // Remove the date text from the title
    text = text.replace(dateResult.text, '').trim();

    triggers.push({
      type: TriggerType.SCHEDULED_TIME,
      config: {
        scheduledDateTime: date.getTime(),
      },
    });
  }

  // Check for location triggers
  const locationPatterns = [
    /when (I|we) (get|arrive|go|drive|walk) (to|at) ([^,\.!?]+)/i,
    /at ([a-z\s']+)(,|\.| when| and|!|\?|$)/i,
    /when (arriving|getting) (to|at) ([^,\.!?]+)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      // Extract location name (last capture group typically)
      let locationName = '';
      for (let i = match.length - 1; i > 0; i--) {
        if (match[i] && !['to', 'at', 'when', 'and', ',', '.', '!', '?'].includes(match[i].toLowerCase())) {
          locationName = match[i].trim();
          break;
        }
      }

      if (locationName) {
        text = text.replace(match[0], '').trim();

        triggers.push({
          type: TriggerType.LOCATION_ENTER,
          locationQuery: locationName,
          activationDateTime: activationTime,
        });

        break; // Only match one location per command
      }
    }
  }

  // Check for charging trigger
  const chargingPatterns = [
    /when (I|my phone|the phone|it) (plug|charge|start charging|is charging)/i,
    /while charging/i,
    /on charge/i,
  ];

  for (const pattern of chargingPatterns) {
    if (pattern.test(text)) {
      triggers.push({
        type: TriggerType.CHARGING_STARTED,
        activationDateTime: activationTime,
      });
      text = text.replace(pattern, '').trim();
      break;
    }
  }

  // Check for unlock trigger
  const unlockPatterns = [
    /when (I|we) unlock (my|the) phone/i,
    /next time I unlock/i,
    /on unlock/i,
  ];

  for (const pattern of unlockPatterns) {
    if (pattern.test(text)) {
      triggers.push({
        type: TriggerType.PHONE_UNLOCK,
        activationDateTime: activationTime,
      });
      text = text.replace(pattern, '').trim();
      break;
    }
  }

  // Check for app trigger
  const appPatterns = [
    /when (I|we) open ([a-z\s]+)(,|\.| and|$)/i,
    /next time I (use|launch) ([a-z\s]+)(,|\.| and|$)/i,
  ];

  for (const pattern of appPatterns) {
    const match = text.match(pattern);
    if (match) {
      const appName = match[2].trim();
      text = text.replace(match[0], '').trim();

      triggers.push({
        type: TriggerType.APP_OPENED,
        appQuery: appName,
        activationDateTime: activationTime,
      });

      break; // Only match one app per command
    }
  }

  // Clean up title
  text = text
    .replace(/^(and|to|,|\.|\!|\?|when|while|on|at)+ /i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If title is too short or empty, use original transcript
  if (text.length < 2) {
    text = originalText;
    confidence = 0.3;
  }

  // Calculate confidence based on what we parsed
  if (triggers.length === 0) {
    confidence = 0.4; // No triggers detected - low confidence
  } else if (triggers.some((t) => t.locationQuery && t.locationQuery.length < 3)) {
    confidence = 0.6; // Ambiguous location
  } else if (triggers.some((t) => t.appQuery && t.appQuery.length < 3)) {
    confidence = 0.6; // Ambiguous app name
  }

  return {
    title: capitalizeFirstLetter(text),
    triggers,
    confidence,
    rawTranscript: transcript,
  };
}

/**
 * Helper to capitalize first letter of a string
 */
function capitalizeFirstLetter(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get a human-readable description of a parsed trigger
 */
export function getTriggerDescription(trigger: ParsedTrigger): string {
  switch (trigger.type) {
    case TriggerType.SCHEDULED_TIME:
      if (trigger.config?.scheduledDateTime) {
        const date = new Date(trigger.config.scheduledDateTime);
        return `At ${date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}`;
      }
      return 'At scheduled time';

    case TriggerType.LOCATION_ENTER:
      if (trigger.locationQuery) {
        return `When you arrive at ${trigger.locationQuery}`;
      }
      if (trigger.config?.name) {
        return `When you arrive at ${trigger.config.name}`;
      }
      return 'When you arrive at location';

    case TriggerType.CHARGING_STARTED:
      return 'When you start charging';

    case TriggerType.PHONE_UNLOCK:
      return 'When you unlock your phone';

    case TriggerType.APP_OPENED:
      if (trigger.appQuery) {
        return `When you open ${trigger.appQuery}`;
      }
      if (trigger.config?.appName) {
        return `When you open ${trigger.config.appName}`;
      }
      return 'When you open app';

    default:
      return trigger.type;
  }
}

/**
 * Get activation time description
 */
export function getActivationDescription(activationDateTime?: number): string {
  if (!activationDateTime) {
    return 'Active immediately';
  }

  const now = Date.now();
  if (activationDateTime <= now) {
    return 'Active now';
  }

  const date = new Date(activationDateTime);
  return `Active from ${date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}
