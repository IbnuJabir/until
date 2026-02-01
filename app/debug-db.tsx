/**
 * Debug Database Viewer - Export DB file to view in DB Browser
 */

import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Paths, File, Directory } from 'expo-file-system';

export default function DebugDatabaseScreen() {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);

  const exportDatabase = async () => {
    setIsExporting(true);
    try {
      // Try to find the database in the document directory
      const sqliteDir = new Directory(Paths.document, 'SQLite');
      const dbFile = new File(sqliteDir, 'until.db');

      // Check if file exists
      const exists = dbFile.exists;

      if (!exists) {
        // Try alternate location
        const dbFileAlt = new File(Paths.document, 'until.db');
        const existsAlt = dbFileAlt.exists;

        if (!existsAlt) {
          Alert.alert(
            'Database Not Found',
            'Could not find the database file. Try creating a reminder first to initialize the database.'
          );
          return;
        }

        // Use alternate file
        exportFile(dbFileAlt);
      } else {
        exportFile(dbFile);
      }
    } catch (error) {
      console.error('[Debug] Export error:', error);
      Alert.alert('Error', `Failed to export database: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportFile = async (dbFile: File) => {
    console.log('[Debug] Found database at:', dbFile.uri);

    // Copy to cache directory for sharing
    const tempFile = new File(Paths.cache, 'until.db');
    await dbFile.copy(tempFile);

    console.log('[Debug] Copied database to:', tempFile.uri);

    // Check if sharing is available
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Error', 'Sharing is not available on this device');
      return;
    }

    // Share the file
    await Sharing.shareAsync(tempFile.uri, {
      mimeType: 'application/x-sqlite3',
      dialogTitle: 'Export Database File',
      UTI: 'public.database',
    });

    console.log('[Debug] Database shared successfully');
  };

  const showDatabaseInfo = async () => {
    try {
      const sqliteDir = new Directory(Paths.document, 'SQLite');
      const dbFile = new File(sqliteDir, 'until.db');

      const exists = dbFile.exists;

      if (exists) {
        const size = dbFile.size;
        const sizeInKB = (size / 1024).toFixed(2);
        Alert.alert(
          'Database Info',
          `Location: ${dbFile.uri}\n\n` +
          `Size: ${sizeInKB} KB\n\n` +
          `Exists: Yes`
        );
      } else {
        Alert.alert('Database Info', 'Database file not found');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to get database info: ${error}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Database Debug</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Export your SQLite database file to view it in DB Browser for SQLite on your Mac.
        </Text>

        <TouchableOpacity
          onPress={exportDatabase}
          style={[styles.button, styles.primaryButton]}
          disabled={isExporting}
        >
          <Text style={styles.buttonIcon}>📤</Text>
          <Text style={styles.buttonText}>
            {isExporting ? 'Exporting...' : 'Export Database File'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={showDatabaseInfo}
          style={[styles.button, styles.secondaryButton]}
        >
          <Text style={styles.buttonIcon}>ℹ️</Text>
          <Text style={styles.buttonText}>Show Database Info</Text>
        </TouchableOpacity>

        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How to use:</Text>
          <Text style={styles.instructionStep}>
            1. Tap &quot;Export Database File&quot;
          </Text>
          <Text style={styles.instructionStep}>
            2. Choose how to transfer (AirDrop, Files, Email, etc.)
          </Text>
          <Text style={styles.instructionStep}>
            3. Save the file to your Mac
          </Text>
          <Text style={styles.instructionStep}>
            4. Open with DB Browser for SQLite
          </Text>
        </View>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Tips:</Text>
          <Text style={styles.tipText}>
            &bull; AirDrop is the fastest method
          </Text>
          <Text style={styles.tipText}>
            &bull; The file is named &quot;until.db&quot;
          </Text>
          <Text style={styles.tipText}>
            &bull; You can view all tables and run SQL queries
          </Text>
          <Text style={styles.tipText}>
            &bull; Changes in DB Browser won&apos;t affect your app
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  description: {
    color: '#999',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  buttonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  instructionsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#333',
  },
  instructionsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  instructionStep: {
    color: '#ccc',
    fontSize: 16,
    lineHeight: 28,
    marginLeft: 8,
  },
  tipsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  tipsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  tipText: {
    color: '#999',
    fontSize: 14,
    lineHeight: 24,
    marginLeft: 8,
  },
});
