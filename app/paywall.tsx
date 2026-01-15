/**
 * Paywall Screen
 * Phase 8 - Will be fully implemented with react-native-iap
 * For now, this is a placeholder
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PaywallScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => router.back()}
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Wait less.{'\n'}Remember better.</Text>
        <Text style={styles.subtitle}>
          Unlock reminders that wait for the right moment.
        </Text>

        <View style={styles.features}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>📍</Text>
            <Text style={styles.featureText}>Remind me when I'm already there</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>📲</Text>
            <Text style={styles.featureText}>Remind me when I open the app</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>🔌</Text>
            <Text style={styles.featureText}>Remind me when I'm actually free</Text>
          </View>
        </View>

        <View style={styles.pricing}>
          <Text style={styles.pricingLabel}>Until Pro</Text>
          <Text style={styles.pricingAmount}>$4.99/month</Text>
          <Text style={styles.pricingNote}>7-day free trial • Cancel anytime</Text>
        </View>

        <TouchableOpacity style={styles.upgradeButton}>
          <Text style={styles.upgradeButtonText}>Start Free Trial</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.restoreButton}>
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Payment will be charged to your Apple ID account. Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 100,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  features: {
    marginBottom: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  pricing: {
    alignItems: 'center',
    marginBottom: 24,
  },
  pricingLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  pricingAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  pricingNote: {
    fontSize: 14,
    color: '#999',
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  restoreButton: {
    paddingVertical: 12,
  },
  restoreButtonText: {
    color: '#007AFF',
    fontSize: 16,
    textAlign: 'center',
  },
  disclaimer: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 16,
  },
});
