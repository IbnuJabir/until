/**
 * Batch Action Bar
 * Bottom action bar for batch operations with smooth slide-in animation
 */

import { Elevation, Spacing, Typography, WarmColors } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface BatchActionBarProps {
  visible: boolean;
  selectedCount: number;
  onDelete: () => void;
}

export function BatchActionBar({
  visible,
  selectedCount,
  onDelete,
}: BatchActionBarProps) {
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 100,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  // Don't render at all when not visible
  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        {/* Delete Button */}
        <TouchableOpacity
          style={[
            styles.deleteButton,
            selectedCount === 0 && styles.deleteButtonDisabled,
          ]}
          onPress={onDelete}
          activeOpacity={0.8}
          disabled={selectedCount === 0}
        >
          <MaterialIcons
            name="delete"
            size={18}
            color={WarmColors.textOnPrimary}
          />
          <Text style={styles.deleteButtonText}>
            Delete {selectedCount > 0 ? `(${selectedCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Decorative top border */}
      <View style={styles.topBorder} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: WarmColors.error,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    paddingBottom: Platform.OS === 'ios' ? 24 : Spacing.xs + 2, // Minimal safe area
    borderTopWidth: 0.5,
    borderTopColor: `${WarmColors.textOnPrimary}15`,
    ...Elevation.level3,
  },
  topBorder: {
    display: 'none',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: .5,
  },
  deleteButtonDisabled: {
    opacity: 0.4,
  },
  deleteButtonText: {
    ...Typography.caption,
    color: WarmColors.textOnPrimary,
    fontWeight: '600',
  },
});
