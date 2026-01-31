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
import { Condition, PaymentEntitlement, Reminder, SavedPlace, Trigger } from '../domain';

/**
 * Global App - represents an app in the user's monitoring library
 */
export interface GlobalApp {
  id: string;          // Unique ID (e.g., "app_instagram")
  displayName: string; // User-facing name (e.g., "Instagram")
  addedAt: number;     // Unix timestamp when added
  usageCount: number;  // How many reminders use this app
}

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
      activation_date_time INTEGER,
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

  // Create saved_places table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS saved_places (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius INTEGER NOT NULL DEFAULT 100,
      icon TEXT,
      address TEXT,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      usage_count INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Create global_apps table (for app library)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS global_apps (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      added_at INTEGER NOT NULL,
      usage_count INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Create index on created_at for ordering
  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_saved_places_created_at
    ON saved_places(created_at DESC);
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
        `INSERT INTO triggers (id, reminder_id, type, config, activation_date_time)
         VALUES (?, ?, ?, ?, ?);`,
        [
          trigger.id,
          reminder.id,
          trigger.type,
          trigger.config ? JSON.stringify(trigger.config) : null,
          trigger.activationDateTime || null,
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
        activationDateTime: triggerRow.activation_date_time || undefined,
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
      activationDateTime: triggerRow.activation_date_time || undefined,
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
    db.execSync('DELETE FROM saved_places;');
    db.execSync('UPDATE entitlements SET has_pro_access = 0, subscription_active = 0 WHERE id = 1;');
    db.execSync('COMMIT;');
    console.log('[Database] Cleared all data');
  } catch (error) {
    db.execSync('ROLLBACK;');
    console.error('[Database] Failed to clear database:', error);
    throw error;
  }
}

// ============================================================================
// SAVED PLACES CRUD
// ============================================================================

/**
 * Save a new place
 */
export async function saveSavedPlace(place: SavedPlace): Promise<void> {
  const db = openDatabase();

  db.runSync(
    `INSERT OR REPLACE INTO saved_places
    (id, name, latitude, longitude, radius, icon, address, created_at, last_used_at, usage_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      place.id,
      place.name,
      place.latitude,
      place.longitude,
      place.radius,
      place.icon || null,
      place.address || null,
      place.createdAt,
      place.lastUsedAt || null,
      place.usageCount,
    ]
  );

  console.log(`[Database] Saved place: ${place.name}`);
}

/**
 * Load all saved places
 */
export async function loadAllSavedPlaces(): Promise<SavedPlace[]> {
  const db = openDatabase();

  const rows = db.getAllSync<any>(
    'SELECT * FROM saved_places ORDER BY created_at DESC;'
  );

  const places: SavedPlace[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    radius: row.radius,
    icon: row.icon,
    address: row.address,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    usageCount: row.usage_count,
  }));

  console.log(`[Database] Loaded ${places.length} saved places`);
  return places;
}

/**
 * Get a single saved place by ID
 */
export async function getSavedPlace(id: string): Promise<SavedPlace | null> {
  const db = openDatabase();

  const row = db.getFirstSync<any>(
    'SELECT * FROM saved_places WHERE id = ?',
    [id]
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    radius: row.radius,
    icon: row.icon,
    address: row.address,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    usageCount: row.usage_count,
  };
}

/**
 * Update a saved place
 */
export async function updateSavedPlace(
  id: string,
  updates: Partial<SavedPlace>
): Promise<void> {
  const db = openDatabase();

  // Build dynamic SQL for only provided fields
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.latitude !== undefined) {
    fields.push('latitude = ?');
    values.push(updates.latitude);
  }
  if (updates.longitude !== undefined) {
    fields.push('longitude = ?');
    values.push(updates.longitude);
  }
  if (updates.radius !== undefined) {
    fields.push('radius = ?');
    values.push(updates.radius);
  }
  if (updates.icon !== undefined) {
    fields.push('icon = ?');
    values.push(updates.icon);
  }
  if (updates.address !== undefined) {
    fields.push('address = ?');
    values.push(updates.address);
  }
  if (updates.lastUsedAt !== undefined) {
    fields.push('last_used_at = ?');
    values.push(updates.lastUsedAt);
  }
  if (updates.usageCount !== undefined) {
    fields.push('usage_count = ?');
    values.push(updates.usageCount);
  }

  if (fields.length === 0) {
    return; // Nothing to update
  }

  values.push(id); // Add id for WHERE clause

  const sql = `UPDATE saved_places SET ${fields.join(', ')} WHERE id = ?`;
  db.runSync(sql, values);

  console.log(`[Database] Updated saved place: ${id}`);
}

/**
 * Delete a saved place
 */
export async function deleteSavedPlace(id: string): Promise<void> {
  const db = openDatabase();

  db.runSync('DELETE FROM saved_places WHERE id = ?', [id]);

  console.log(`[Database] Deleted saved place: ${id}`);
}

/**
 * Increment usage count for a saved place
 */
export async function incrementPlaceUsage(id: string): Promise<void> {
  const db = openDatabase();

  db.runSync(
    'UPDATE saved_places SET usage_count = usage_count + 1, last_used_at = ? WHERE id = ?',
    [Date.now(), id]
  );

  console.log(`[Database] Incremented usage count for place: ${id}`);
}

// ============================================================================
// GLOBAL APPS CRUD (App Library for Screen Time Monitoring)
// ============================================================================

/**
 * Save a global app to the library
 */
export async function saveGlobalApp(app: GlobalApp): Promise<void> {
  const db = openDatabase();

  db.runSync(
    `INSERT OR REPLACE INTO global_apps
    (id, display_name, added_at, usage_count)
    VALUES (?, ?, ?, ?)`,
    [app.id, app.displayName, app.addedAt, app.usageCount]
  );

  console.log(`[Database] Saved global app: ${app.displayName}`);
}

/**
 * Load all global apps from the library
 */
export async function loadAllGlobalApps(): Promise<GlobalApp[]> {
  const db = openDatabase();

  const rows = db.getAllSync<any>(
    'SELECT * FROM global_apps ORDER BY added_at DESC;'
  );

  const apps: GlobalApp[] = rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    addedAt: row.added_at,
    usageCount: row.usage_count,
  }));

  console.log(`[Database] Loaded ${apps.length} global apps`);
  return apps;
}

/**
 * Get a single global app by ID
 */
export async function getGlobalApp(id: string): Promise<GlobalApp | null> {
  const db = openDatabase();

  const row = db.getFirstSync<any>(
    'SELECT * FROM global_apps WHERE id = ?',
    [id]
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    displayName: row.display_name,
    addedAt: row.added_at,
    usageCount: row.usage_count,
  };
}

/**
 * Update a global app's display name
 */
export async function updateGlobalAppName(
  id: string,
  displayName: string
): Promise<void> {
  const db = openDatabase();

  db.runSync('UPDATE global_apps SET display_name = ? WHERE id = ?', [
    displayName,
    id,
  ]);

  console.log(`[Database] Updated global app name: ${id}`);
}

/**
 * Delete a global app from the library
 */
export async function deleteGlobalApp(id: string): Promise<void> {
  const db = openDatabase();

  db.runSync('DELETE FROM global_apps WHERE id = ?', [id]);

  console.log(`[Database] Deleted global app: ${id}`);
}

/**
 * Increment usage count for a global app
 */
export async function incrementGlobalAppUsage(id: string): Promise<void> {
  const db = openDatabase();

  db.runSync(
    'UPDATE global_apps SET usage_count = usage_count + 1 WHERE id = ?',
    [id]
  );

  console.log(`[Database] Incremented usage count for global app: ${id}`);
}
