/**
 * Crash Reporter
 * Sends error reports to a Telegram bot for monitoring production crashes.
 *
 * Usage:
 * - Call initCrashReporter() once at app startup to capture unhandled JS errors.
 * - Call reportError(error, context?) to manually report caught errors.
 *
 * Rate limited to 5 reports per minute to avoid Telegram API spam.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// Configuration - replace with your actual Telegram bot token and chat ID
// ---------------------------------------------------------------------------
const TELEGRAM_BOT_TOKEN = 'TELEGRAM_BOT_TOKEN';
const TELEGRAM_CHAT_ID = 'TELEGRAM_CHAT_ID';

const SEND_MESSAGE_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const MAX_REPORTS_PER_MINUTE = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

const reportTimestamps: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();

  // Remove timestamps older than the window
  while (reportTimestamps.length > 0 && reportTimestamps[0] <= now - RATE_LIMIT_WINDOW_MS) {
    reportTimestamps.shift();
  }

  if (reportTimestamps.length >= MAX_REPORTS_PER_MINUTE) {
    if (__DEV__) {
      console.warn('[CrashReporter] Rate limit reached, skipping report');
    }
    return true;
  }

  reportTimestamps.push(now);
  return false;
}

// ---------------------------------------------------------------------------
// Device & app info
// ---------------------------------------------------------------------------
function getDeviceInfo(): string {
  const os = Platform.OS;
  const version = Platform.Version;
  return `${os} ${version}`;
}

function getAppVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

// ---------------------------------------------------------------------------
// Telegram transport
// ---------------------------------------------------------------------------
function truncateStack(stack: string | undefined, maxLength: number): string {
  if (!stack) return 'No stack trace';
  if (stack.length <= maxLength) return stack;
  return stack.slice(0, maxLength) + '\n... (truncated)';
}

function buildMessage(error: Error, context?: string): string {
  const timestamp = new Date().toISOString();
  const device = getDeviceInfo();
  const appVersion = getAppVersion();
  const stack = truncateStack(error.stack, 1000);

  const lines: string[] = [
    `\u{1F6A8} *Crash Report*`,
    ``,
    `*Error:* ${escapeMarkdown(error.name)}`,
    `*Message:* ${escapeMarkdown(error.message)}`,
    ...(context ? [`*Context:* ${escapeMarkdown(context)}`] : []),
    ``,
    `*Device:* ${escapeMarkdown(device)}`,
    `*App Version:* ${escapeMarkdown(appVersion)}`,
    `*Timestamp:* ${escapeMarkdown(timestamp)}`,
    ``,
    `*Stack Trace:*`,
    '```',
    stack,
    '```',
  ];

  return lines.join('\n');
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

async function sendToTelegram(message: string): Promise<void> {
  try {
    const response = await fetch(SEND_MESSAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'MarkdownV2',
      }),
    });

    if (!response.ok) {
      if (__DEV__) {
        const body = await response.text();
        console.error('[CrashReporter] Telegram API error:', response.status, body);
      }
    } else {
      if (__DEV__) {
        console.log('[CrashReporter] Report sent successfully');
      }
    }
  } catch (networkError) {
    if (__DEV__) {
      console.error('[CrashReporter] Failed to send report:', networkError);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Report an error to Telegram.
 *
 * Can be called manually from try/catch blocks to report caught errors.
 * Respects the rate limit of 5 reports per minute.
 */
export async function reportError(error: Error, context?: string): Promise<void> {
  if (isRateLimited()) return;

  const message = buildMessage(error, context);
  await sendToTelegram(message);
}

/**
 * Initialise the crash reporter.
 *
 * Sets up a global error handler via ErrorUtils so that unhandled JS
 * exceptions are automatically reported to Telegram. The previous global
 * handler (if any) is preserved and still called after reporting.
 *
 * Call this once at app startup (e.g. in the root layout).
 */
export function initCrashReporter(): void {
  if (__DEV__) {
    console.log('[CrashReporter] Initialising crash reporter');
  }

  const previousHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    // Fire-and-forget; we intentionally do not await so as not to block the
    // default error handler chain.
    reportError(error, isFatal ? 'Fatal JS error' : 'Unhandled JS error');

    // Preserve the original handler behaviour
    if (previousHandler) {
      previousHandler(error, isFatal);
    }
  });

  if (__DEV__) {
    console.log('[CrashReporter] Global error handler installed');
  }
}
