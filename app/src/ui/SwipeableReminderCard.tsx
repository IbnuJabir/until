/**
 * Swipeable Reminder Card
 * Modern gestural deletion with smooth animations and visual feedback
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Reminder, ReminderStatus, TriggerType } from '@/app/src/domain';
import { format } from 'date-fns';
import { WarmColors, Elevation, Spacing, BorderRadius, Typography } from '@/constants/theme';

interface SwipeableReminderCardProps {
  item: Reminder;
  onPress: () => void;
  onDelete: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function SwipeableReminderCard({
  item,
  onPress,
  onDelete,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: SwipeableReminderCardProps) {
  const isFired = item.status === ReminderStatus.FIRED;
  const primaryTrigger = item.triggers[0];

  const getTriggerIcon = (type: TriggerType): keyof typeof MaterialIcons.glyphMap => {
    switch (type) {
      case TriggerType.PHONE_UNLOCK:
        return 'smartphone';
      case TriggerType.LOCATION_ENTER:
        return 'location-on';
      case TriggerType.CHARGING_STARTED:
        return 'battery-charging-full';
      case TriggerType.APP_OPENED:
        return 'apps';
      case TriggerType.SCHEDULED_TIME:
      case TriggerType.TIME_WINDOW:
        return 'schedule';
      default:
        return 'notifications';
    }
  };

  const triggerIcon = primaryTrigger ? getTriggerIcon(primaryTrigger.type) : 'notifications';

  const handlePress = () => {
    if (isSelectionMode && onToggleSelect) {
      // In selection mode, tap toggles selection
      onToggleSelect();
    } else {
      // Normal mode - navigate to detail
      onPress();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.reminderCard,
          isFired && styles.reminderCardFired,
          isSelected && styles.reminderCardSelected,
        ]}
        onPress={handlePress}
        onLongPress={onDelete}
        activeOpacity={0.8}
      >
          <View style={styles.reminderContent}>
            {/* Selection Checkbox */}
            {isSelectionMode && (
              <View style={styles.checkboxContainer}>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && (
                    <MaterialIcons name="check" size={18} color={WarmColors.textOnPrimary} />
                  )}
                </View>
              </View>
            )}

            {/* Icon */}
            <View style={[styles.reminderIconContainer, !isFired && styles.reminderIconContainerActive]}>
              <MaterialIcons
                name={triggerIcon}
                size={24}
                color={isFired ? WarmColors.textTertiary : WarmColors.primary}
              />
            </View>

            {/* Content */}
            <View style={styles.reminderTextContainer}>
              <View style={styles.reminderHeader}>
                <Text style={[styles.reminderTitle, isFired && styles.textFired]} numberOfLines={2}>
                  {item.title}
                </Text>
                {isFired && (
                  <View style={styles.firedBadge}>
                    <MaterialIcons name="check-circle" size={14} color={WarmColors.success} />
                    <Text style={styles.firedBadgeText}>Fired</Text>
                  </View>
                )}
              </View>

              {item.description && (
                <Text style={[styles.reminderDescription, isFired && styles.textFired]} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              <View style={styles.reminderMeta}>
                <View style={styles.metaItem}>
                  <MaterialIcons name="notifications-active" size={14} color={WarmColors.textSecondary} />
                  <Text style={[styles.metaText, isFired && styles.textFired]}>
                    {item.triggers.length} trigger{item.triggers.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialIcons name="calendar-today" size={14} color={WarmColors.textSecondary} />
                  <Text style={[styles.metaText, isFired && styles.textFired]}>
                    {format(item.createdAt, 'MMM d')}
                  </Text>
                </View>
              </View>

              {isFired && item.firedAt && (
                <View style={styles.firedAtContainer}>
                  <MaterialIcons name="check-circle" size={12} color={WarmColors.success} />
                  <Text style={styles.firedAtText}>
                    Fired {format(item.firedAt, 'MMM d, h:mm a')}
                  </Text>
                </View>
              )}
            </View>
          </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  reminderCard: {
    backgroundColor: WarmColors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: WarmColors.border,
    ...Elevation.level2,
  },
  reminderCardFired: {
    backgroundColor: WarmColors.surfaceVariant,
    borderColor: WarmColors.divider,
    opacity: 0.85,
  },
  reminderCardSelected: {
    borderColor: WarmColors.primary,
    borderWidth: 2,
    backgroundColor: `${WarmColors.primary}08`,
  },
  reminderContent: {
    flexDirection: 'row',
  },
  checkboxContainer: {
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: WarmColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: WarmColors.surface,
  },
  checkboxSelected: {
    backgroundColor: WarmColors.primary,
    borderColor: WarmColors.primary,
  },
  reminderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: WarmColors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  reminderIconContainerActive: {
    backgroundColor: `${WarmColors.primary}15`,
  },
  reminderTextContainer: {
    flex: 1,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  reminderTitle: {
    ...Typography.bodyBold,
    color: WarmColors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  firedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${WarmColors.success}15`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  firedBadgeText: {
    ...Typography.small,
    color: WarmColors.success,
    fontWeight: '600',
  },
  reminderDescription: {
    ...Typography.body,
    color: WarmColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  reminderMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...Typography.small,
    color: WarmColors.textSecondary,
  },
  firedAtContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 4,
  },
  firedAtText: {
    ...Typography.small,
    color: WarmColors.success,
    fontWeight: '500',
  },
  textFired: {
    color: WarmColors.textTertiary,
  },
});
