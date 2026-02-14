import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Share, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useReminderStore } from '@/app/src/store/reminderStore';
import { WarmColors, Elevation, Spacing, BorderRadius, Typography } from '@/constants/theme';

interface SettingsItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  onPress: () => void;
}

export default function ExploreScreen() {
  const router = useRouter();
  const { reminders, loadFromStorage } = useReminderStore();

  const handleExportData = async () => {
    try {
      const data = JSON.stringify(reminders, null, 2);
      await Share.share({
        message: data,
        title: 'Until - My Reminders',
      });
    } catch (error) {
      if (error instanceof Error && error.message !== 'User did not share') {
        Alert.alert('Export Failed', 'Could not export your data. Please try again.');
      }
    }
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all your reminders and saved places. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const { clearDatabase } = await import('@/app/src/storage/database');
              await clearDatabase();
              await loadFromStorage();
              Alert.alert('Done', 'All data has been deleted.');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete data. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://until-app.com/privacy');
  };

  const handleReportBug = () => {
    Linking.openURL('mailto:support@until-app.com?subject=Bug Report');
  };

  const handleRateApp = () => {
    Alert.alert('Coming Soon', 'App Store rating will be available in a future update.');
  };

  const handleDatabaseDebug = () => {
    router.push('/debug-db' as any);
  };

  const aboutItems: SettingsItem[] = [
    {
      id: 'app-info',
      title: 'Until',
      subtitle: 'Version 1.0.0 — Context-aware reminders',
      icon: 'info-outline',
      color: WarmColors.primary,
      onPress: () => {},
    },
  ];

  const dataPrivacyItems: SettingsItem[] = [
    {
      id: 'export-data',
      title: 'Export My Data',
      subtitle: 'Share all reminders as JSON',
      icon: 'file-download',
      color: WarmColors.info,
      onPress: handleExportData,
    },
    {
      id: 'delete-data',
      title: 'Delete All Data',
      subtitle: 'Permanently remove all reminders and places',
      icon: 'delete-forever',
      color: WarmColors.error,
      onPress: handleDeleteAllData,
    },
    {
      id: 'privacy-policy',
      title: 'Privacy Policy',
      subtitle: 'How we handle your data',
      icon: 'privacy-tip',
      color: WarmColors.secondary,
      onPress: handlePrivacyPolicy,
    },
  ];

  const supportItems: SettingsItem[] = [
    {
      id: 'report-bug',
      title: 'Report a Bug',
      subtitle: 'Send us an email about issues',
      icon: 'bug-report',
      color: WarmColors.warning,
      onPress: handleReportBug,
    },
    {
      id: 'rate-app',
      title: 'Rate Until',
      subtitle: 'Leave a review on the App Store',
      icon: 'star-outline',
      color: WarmColors.accent,
      onPress: handleRateApp,
    },
  ];

  const debugItems: SettingsItem[] = [
    {
      id: 'debug-db',
      title: 'Database Debug',
      subtitle: 'Inspect and export database contents',
      icon: 'storage',
      color: '#FF6B6B',
      onPress: handleDatabaseDebug,
    },
  ];

  const renderItem = (item: SettingsItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.actionCard}
      onPress={item.onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.actionIconContainer, { backgroundColor: `${item.color}15` }]}>
        <MaterialIcons name={item.icon} size={24} color={item.color} />
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{item.title}</Text>
        <Text style={styles.actionDescription}>{item.subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={WarmColors.textTertiary} />
    </TouchableOpacity>
  );

  const renderSection = (title: string, items: SettingsItem[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map(renderItem)}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Preferences & privacy</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {renderSection('About', aboutItems)}
        {renderSection('Data & Privacy', dataPrivacyItems)}
        {renderSection('Support', supportItems)}
        {__DEV__ && renderSection('Debug', debugItems)}
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
    borderBottomWidth: 1,
    borderBottomColor: WarmColors.border,
    ...Elevation.level1,
  },
  headerTitle: {
    ...Typography.h2,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: WarmColors.textSecondary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.md,
  },
  actionCard: {
    backgroundColor: WarmColors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...Elevation.level2,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    ...Typography.bodyBold,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  actionDescription: {
    ...Typography.caption,
    color: WarmColors.textSecondary,
  },
});
