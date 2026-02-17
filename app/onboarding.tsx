import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';

import { WarmColors, Elevation, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { requestNotificationPermissions } from '@/app/src/utils/NotificationService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingPage {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
}

const pages: OnboardingPage[] = [
  {
    icon: 'notifications-active',
    title: 'Welcome to Until',
    subtitle:
      'Reminders that fire at the right moment \u2014 not just at a set time.',
  },
  {
    icon: 'bolt',
    title: 'Context-Aware Triggers',
    subtitle:
      'Set reminders for when you unlock your phone, start charging, arrive somewhere, or open an app.',
  },
  {
    icon: 'check-circle',
    title: 'Stay Notified',
    subtitle:
      'Enable notifications so your reminders can reach you at the perfect time.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [pageIndex, setPageIndex] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Animated value for smooth page transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const isLastPage = pageIndex === pages.length - 1;
  const currentPage = pages[pageIndex];

  const animateTransition = (nextIndex: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Update page index at the midpoint of the animation
    setTimeout(() => setPageIndex(nextIndex), 150);
  };

  const handleNext = () => {
    if (pageIndex < pages.length - 1) {
      animateTransition(pageIndex + 1);
    }
  };

  const handleBack = () => {
    if (pageIndex > 0) {
      animateTransition(pageIndex - 1);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
  };

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermissions();
    setNotificationsEnabled(granted);
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('@onboarding_complete', 'true');
    router.replace('/(tabs)');
  };

  const handleGetStarted = async () => {
    await completeOnboarding();
  };

  return (
    <View style={styles.container}>
      {/* Skip button - shown on pages 1 and 2 */}
      {!isLastPage && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Page content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.iconContainer}>
          <MaterialIcons
            name={currentPage.icon}
            size={80}
            color={WarmColors.primary}
          />
        </View>

        <Text style={styles.title}>{currentPage.title}</Text>
        <Text style={styles.subtitle}>{currentPage.subtitle}</Text>

        {/* Action buttons on last page */}
        {isLastPage && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.notificationButton,
                notificationsEnabled && styles.notificationButtonDisabled,
              ]}
              onPress={handleEnableNotifications}
              disabled={notificationsEnabled}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name={notificationsEnabled ? 'check' : 'notifications'}
                size={20}
                color={
                  notificationsEnabled
                    ? WarmColors.success
                    : WarmColors.primary
                }
                style={styles.buttonIcon}
              />
              <Text
                style={[
                  styles.notificationButtonText,
                  notificationsEnabled &&
                    styles.notificationButtonTextDisabled,
                ]}
              >
                {notificationsEnabled
                  ? 'Notifications Enabled'
                  : 'Enable Notifications'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.getStartedButton}
              onPress={handleGetStarted}
              activeOpacity={0.8}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Bottom navigation */}
      <View style={styles.bottomNav}>
        {/* Page dots */}
        <View style={styles.dotsContainer}>
          {pages.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === pageIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Navigation buttons */}
        <View style={styles.navButtons}>
          {pageIndex > 0 ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="arrow-back"
                size={20}
                color={WarmColors.textSecondary}
              />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.navPlaceholder} />
          )}

          {!isLastPage && (
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.nextText}>Next</Text>
              <MaterialIcons
                name="arrow-forward"
                size={20}
                color={WarmColors.textOnPrimary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WarmColors.background,
  },
  skipButton: {
    position: 'absolute',
    top: Spacing.xxl + Spacing.md,
    right: Spacing.lg,
    zIndex: 10,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipText: {
    ...Typography.caption,
    color: WarmColors.textSecondary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: WarmColors.surfaceWarm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Elevation.level2,
  },
  title: {
    ...Typography.h2,
    color: WarmColors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subtitle: {
    ...Typography.body,
    color: WarmColors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: SCREEN_WIDTH * 0.8,
  },
  actionButtons: {
    marginTop: Spacing.xl + Spacing.md,
    width: '100%',
    alignItems: 'center',
    gap: Spacing.md,
  },
  notificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: SCREEN_WIDTH * 0.75,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: WarmColors.primary,
    backgroundColor: WarmColors.surface,
  },
  notificationButtonDisabled: {
    borderColor: WarmColors.success,
    backgroundColor: WarmColors.surfaceWarm,
  },
  buttonIcon: {
    marginRight: Spacing.sm,
  },
  notificationButtonText: {
    ...Typography.bodyBold,
    color: WarmColors.primary,
  },
  notificationButtonTextDisabled: {
    color: WarmColors.success,
  },
  getStartedButton: {
    width: SCREEN_WIDTH * 0.75,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: WarmColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.level2,
  },
  getStartedText: {
    ...Typography.bodyBold,
    color: WarmColors.textOnPrimary,
  },
  bottomNav: {
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: WarmColors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: WarmColors.primary,
  },
  navButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navPlaceholder: {
    width: 80,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  backText: {
    ...Typography.caption,
    color: WarmColors.textSecondary,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: WarmColors.primary,
    gap: Spacing.xs,
    ...Elevation.level1,
  },
  nextText: {
    ...Typography.bodyBold,
    color: WarmColors.textOnPrimary,
  },
});
