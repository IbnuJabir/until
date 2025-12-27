/**
 * SQLite Database Layer
 * Follows CONTEXT.md Phase 8 - Local storage with SQLite
 *
 * Schema:
 * - reminders: Core reminder data
 * - triggers: One-to-many with reminders
 * - conditions: One-to-many with reminders
 */

import * as SQLite from 'expo-sqlite';
import { Reminder, Trigger, Condition, PaymentEntitlement } from '../domain';

const DATABASE_NAME = 'until.db';

/**
 * Get database connection
 */
export function openDatabase(): SQLite.SQLiteDatabase {
  return SQLite.openDatabaseSync(DATABASE_NAME);
}

/**
 * Initialize database schema
 */
export async function initDatabase(): Promise<void> {
  const db = openDatabase();

  // Create reminders table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      fired_at INTEGER,
      expires_at INTEGER
    );
  `);

  // Create triggers table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS triggers (
      id TEXT PRIMARY KEY NOT NULL,
      reminder_id TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT,
      FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
    );
  `);

  // Create index on reminder_id for faster lookups
  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_triggers_reminder_id
    ON triggers(reminder_id);
  `);

  // Create conditions table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS conditions (
      id TEXT PRIMARY KEY NOT NULL,
      reminder_id TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT NOT NULL,
      FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
    );
  `);

  // Create index on reminder_id for faster lookups
  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_conditions_reminder_id
    ON conditions(reminder_id);
  `);

  // Create entitlements table (payment info)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS entitlements (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      has_pro_access INTEGER NOT NULL DEFAULT 0,
      subscription_active INTEGER NOT NULL DEFAULT 0,
      product_id TEXT,
      purchase_date INTEGER,
      expiry_date INTEGER
    );
  `);

  // Insert default entitlement row if not exists
  db.execSync(`
    INSERT OR IGNORE INTO entitlements (id, has_pro_access, subscription_active)
    VALUES (1, 0, 0);
  `);

  console.log('[Database] Initialized successfully');
}

/**
 * Save a reminder with its triggers and conditions
 */
export async function saveReminder(reminder: Reminder): Promise<void> {
  const db = openDatabase();

  try {
    db.execSync('BEGIN TRANSACTION;');

    // Insert or replace reminder
    db.runSync(
      `INSERT OR REPLACE INTO reminders (id, title, description, status, created_at, fired_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        reminder.id,
        reminder.title,
        reminder.description || null,
        reminder.status,
        reminder.createdAt,
        reminder.firedAt || null,
        reminder.expiresAt || null,
      ]
    );

    // Delete existing triggers and conditions
    db.runSync('DELETE FROM triggers WHERE reminder_id = ?;', [reminder.id]);
    db.runSync('DELETE FROM conditions WHERE reminder_id = ?;', [reminder.id]);

    // Insert triggers
    for (const trigger of reminder.triggers) {
      db.runSync(
        `INSERT INTO triggers (id, reminder_id, type, config)
         VALUES (?, ?, ?, ?);`,
        [
          trigger.id,
          reminder.id,
          trigger.type,
          trigger.config ? JSON.stringify(trigger.config) : null,
        ]
      );
    }

    // Insert conditions
    for (const condition of reminder.conditions) {
      db.runSync(
        `INSERT INTO conditions (id, reminder_id, type, config)
         VALUES (?, ?, ?, ?);`,
        [
          condition.id,
          reminder.id,
          condition.type,
          JSON.stringify(condition.config),
        ]
      );
    }

    db.execSync('COMMIT;');
  } catch (error) {
    db.execSync('ROLLBACK;');
    console.error('[Database] Failed to save reminder:', error);
    throw error;
  }
}

/**
 * Load all reminders with their triggers and conditions
 */
export async function loadAllReminders(): Promise<Reminder[]> {
  const db = openDatabase();

  try {
    // Load all reminders
    const reminderRows = db.getAllSync('SELECT * FROM reminders;');

    const reminders: Reminder[] = [];

    for (const row of reminderRows as any[]) {
      // Load triggers for this reminder
      const triggerRows = db.getAllSync(
        'SELECT * FROM triggers WHERE reminder_id = ?;',
        [row.id]
      );

      const triggers: Trigger[] = (triggerRows as any[]).map((triggerRow) => ({
        id: triggerRow.id,
        type: triggerRow.type,
        config: triggerRow.config ? JSON.parse(triggerRow.config) : null,
      }));

      // Load conditions for this reminder
      const conditionRows = db.getAllSync(
        'SELECT * FROM conditions WHERE reminder_id = ?;',
        [row.id]
      );

      const conditions: Condition[] = (conditionRows as any[]).map(
        (conditionRow) => ({
          id: conditionRow.id,
          type: conditionRow.type,
          config: JSON.parse(conditionRow.config),
        })
      );

      // Build reminder object
      const reminder: Reminder = {
        id: row.id,
        title: row.title,
        description: row.description || undefined,
        triggers,
        conditions,
        status: row.status,
        createdAt: row.created_at,
        firedAt: row.fired_at || undefined,
        expiresAt: row.expires_at || undefined,
      };

      reminders.push(reminder);
    }

    return reminders;
  } catch (error) {
    console.error('[Database] Failed to load reminders:', error);
    throw error;
  }
}

/**
 * Delete a reminder (cascades to triggers and conditions)
 */
export async function deleteReminder(id: string): Promise<void> {
  const db = openDatabase();

  try {
    db.runSync('DELETE FROM reminders WHERE id = ?;', [id]);
    console.log(`[Database] Deleted reminder: ${id}`);
  } catch (error) {
    console.error('[Database] Failed to delete reminder:', error);
    throw error;
  }
}

/**
 * Get a single reminder by ID
 */
export async function getReminderById(id: string): Promise<Reminder | null> {
  const db = openDatabase();

  try {
    const row = db.getFirstSync('SELECT * FROM reminders WHERE id = ?;', [id]);

    if (!row) {
      return null;
    }

    const reminderRow = row as any;

    // Load triggers
    const triggerRows = db.getAllSync(
      'SELECT * FROM triggers WHERE reminder_id = ?;',
      [id]
    );

    const triggers: Trigger[] = (triggerRows as any[]).map((triggerRow) => ({
      id: triggerRow.id,
      type: triggerRow.type,
      config: triggerRow.config ? JSON.parse(triggerRow.config) : null,
    }));

    // Load conditions
    const conditionRows = db.getAllSync(
      'SELECT * FROM conditions WHERE reminder_id = ?;',
      [id]
    );

    const conditions: Condition[] = (conditionRows as any[]).map(
      (conditionRow) => ({
        id: conditionRow.id,
        type: conditionRow.type,
        config: JSON.parse(conditionRow.config),
      })
    );

    return {
      id: reminderRow.id,
      title: reminderRow.title,
      description: reminderRow.description || undefined,
      triggers,
      conditions,
      status: reminderRow.status,
      createdAt: reminderRow.created_at,
      firedAt: reminderRow.fired_at || undefined,
      expiresAt: reminderRow.expires_at || undefined,
    };
  } catch (error) {
    console.error('[Database] Failed to get reminder:', error);
    throw error;
  }
}

/**
 * Save payment entitlements
 */
export async function saveEntitlements(
  entitlements: PaymentEntitlement
): Promise<void> {
  const db = openDatabase();

  try {
    db.runSync(
      `UPDATE entitlements
       SET has_pro_access = ?,
           subscription_active = ?,
           product_id = ?,
           purchase_date = ?,
           expiry_date = ?
       WHERE id = 1;`,
      [
        entitlements.hasProAccess ? 1 : 0,
        entitlements.subscriptionActive ? 1 : 0,
        entitlements.productId || null,
        entitlements.purchaseDate || null,
        entitlements.expiryDate || null,
      ]
    );
    console.log('[Database] Saved entitlements');
  } catch (error) {
    console.error('[Database] Failed to save entitlements:', error);
    throw error;
  }
}

/**
 * Load payment entitlements
 */
export async function loadEntitlements(): Promise<PaymentEntitlement> {
  const db = openDatabase();

  try {
    const row = db.getFirstSync('SELECT * FROM entitlements WHERE id = 1;');

    if (!row) {
      // Return default (free tier)
      return {
        hasProAccess: false,
        subscriptionActive: false,
      };
    }

    const entitlementRow = row as any;

    return {
      hasProAccess: entitlementRow.has_pro_access === 1,
      subscriptionActive: entitlementRow.subscription_active === 1,
      productId: entitlementRow.product_id || undefined,
      purchaseDate: entitlementRow.purchase_date || undefined,
      expiryDate: entitlementRow.expiry_date || undefined,
    };
  } catch (error) {
    console.error('[Database] Failed to load entitlements:', error);
    throw error;
  }
}

/**
 * Clear all data (for testing/debugging)
 */
export async function clearDatabase(): Promise<void> {
  const db = openDatabase();

  try {
    db.execSync('BEGIN TRANSACTION;');
    db.execSync('DELETE FROM reminders;');
    db.execSync('DELETE FROM triggers;');
    db.execSync('DELETE FROM conditions;');
    db.execSync('UPDATE entitlements SET has_pro_access = 0, subscription_active = 0 WHERE id = 1;');
    db.execSync('COMMIT;');
    console.log('[Database] Cleared all data');
  } catch (error) {
    db.execSync('ROLLBACK;');
    console.error('[Database] Failed to clear database:', error);
    throw error;
  }
}
