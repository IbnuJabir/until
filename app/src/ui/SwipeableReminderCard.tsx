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

  const cardAccessibilityLabel = isSelectionMode
    ? `${item.title}, ${isSelected ? 'selected' : 'not selected'}, double tap to ${isSelected ? 'deselect' : 'select'}`
    : `${item.title}, ${isFired ? 'completed' : 'active'} reminder, double tap to view details`;

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
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={cardAccessibilityLabel}
        accessibilityState={{ selected: isSelected }}
      >
        <View style={styles.reminderContent}>
          {/* Selection Checkbox */}
          {isSelectionMode && (
            <View style={styles.checkboxContainer}>
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && (
                  <MaterialIcons name="check" size={16} color={WarmColors.textOnPrimary} />
                )}
              </View>
            </View>
          )}

          {/* Compact Icon */}
          <View style={[styles.iconContainer, !isFired && styles.iconContainerActive]}>
            <MaterialIcons
              name={triggerIcon}
              size={18}
              color={isFired ? WarmColors.textTertiary : WarmColors.primary}
            />
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, isFired && styles.titleFired]} numberOfLines={1}>
                {item.title}
              </Text>
              {isFired && (
                <View style={styles.firedBadge}>
                  <MaterialIcons name="check-circle" size={10} color={WarmColors.success} />
                </View>
              )}
            </View>

            {/* Compact metadata row */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={[styles.metaText, isFired && styles.metaTextFired]}>
                  {item.triggers.length} trigger{item.triggers.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={[styles.metaText, isFired && styles.metaTextFired]}>
                  {format(item.createdAt, 'MMM d')}
                </Text>
              </View>
              {isFired && item.firedAt && (
                <>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaItem}>
                    <Text style={styles.firedAtText}>
                      {format(item.firedAt, 'h:mm a')}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.compact.md,
  },
  reminderCard: {
    backgroundColor: WarmColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.compact.md,
    borderWidth: 0.5,
    borderColor: WarmColors.borderLight,
    ...Elevation.level1,
  },
  reminderCardFired: {
    backgroundColor: WarmColors.surfaceWarm,
    borderColor: WarmColors.divider,
  },
  reminderCardSelected: {
    borderColor: WarmColors.primary,
    borderWidth: 1.5,
    backgroundColor: `${WarmColors.primary}05`,
  },
  reminderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    justifyContent: 'center',
    marginRight: Spacing.compact.sm + 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: WarmColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: WarmColors.surface,
  },
  checkboxSelected: {
    backgroundColor: WarmColors.primary,
    borderColor: WarmColors.primary,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: WarmColors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.compact.sm + 2,
  },
  iconContainerActive: {
    backgroundColor: `${WarmColors.primary}12`,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.compact.xs,
  },
  title: {
    ...Typography.cardTitle,
    color: WarmColors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  titleFired: {
    color: WarmColors.textSecondary,
  },
  firedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: `${WarmColors.success}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    ...Typography.tiny,
    color: WarmColors.textSecondary,
    textTransform: 'uppercase',
  },
  metaTextFired: {
    color: WarmColors.textTertiary,
  },
  metaDivider: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: WarmColors.textTertiary,
    marginHorizontal: Spacing.compact.sm,
  },
  firedAtText: {
    ...Typography.tiny,
    color: WarmColors.success,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  textFired: {
    color: WarmColors.textTertiary,
  },
});
