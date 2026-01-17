/**
 * List of saved places with selection functionality
 * Shows user's previously saved locations for quick selection
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SavedPlace } from '../domain/types';
import { useReminderStore } from '../store/reminderStore';
import { WarmColors, Elevation, Spacing, BorderRadius, Typography } from '@/constants/theme';

interface SavedPlacesListProps {
  onSelectPlace: (place: SavedPlace) => void;
  onAddNewPlace: () => void;
}

export default function SavedPlacesList({
  onSelectPlace,
  onAddNewPlace,
}: SavedPlacesListProps) {
  const savedPlaces = useReminderStore((state) => state.savedPlaces);
  const deleteSavedPlace = useReminderStore((state) => state.deleteSavedPlace);

  const handleDeletePlace = (place: SavedPlace) => {
    Alert.alert(
      'Delete Place',
      `Are you sure you want to delete "${place.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSavedPlace(place.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete place');
            }
          },
        },
      ]
    );
  };

  const renderPlaceItem = ({ item }: { item: SavedPlace }) => {
    return (
      <View style={styles.placeCard}>
        <TouchableOpacity
          style={styles.placeContent}
          onPress={() => onSelectPlace(item)}
          activeOpacity={0.8}
        >
          <View style={styles.placeIconContainer}>
            <MaterialIcons name="location-on" size={24} color={WarmColors.primary} />
          </View>
          <View style={styles.placeInfo}>
            <Text style={styles.placeName}>{item.name}</Text>
            {item.address && <Text style={styles.placeAddress}>{item.address}</Text>}
            <View style={styles.placeDetails}>
              <View style={styles.detailItem}>
                <MaterialIcons name="radio-button-unchecked" size={12} color={WarmColors.textSecondary} />
                <Text style={styles.detailText}>{item.radius}m radius</Text>
              </View>
              <View style={styles.detailItem}>
                <MaterialIcons name="history" size={12} color={WarmColors.textSecondary} />
                <Text style={styles.detailText}>
                  Used {item.usageCount} {item.usageCount === 1 ? 'time' : 'times'}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeletePlace(item)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="delete-outline" size={18} color={WarmColors.error} />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <MaterialIcons name="location-off" size={64} color={WarmColors.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>No Saved Places</Text>
      <Text style={styles.emptyText}>
        Add your first location to quickly create location-based reminders
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Select a Place</Text>
          <Text style={styles.headerSubtitle}>
            Choose from your saved locations or add a new one
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={onAddNewPlace} activeOpacity={0.8}>
          <MaterialIcons name="add" size={20} color={WarmColors.textOnPrimary} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={savedPlaces}
        renderItem={renderPlaceItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WarmColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: WarmColors.border,
    ...Elevation.level1,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.md,
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
  listContent: {
    padding: Spacing.md,
    paddingBottom: 120,
    flexGrow: 1,
  },
  placeCard: {
    backgroundColor: WarmColors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: WarmColors.border,
    ...Elevation.level2,
  },
  placeContent: {
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  placeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${WarmColors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    ...Typography.bodyBold,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.xs,
  },
  placeAddress: {
    ...Typography.caption,
    color: WarmColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  placeDetails: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    ...Typography.small,
    color: WarmColors.textSecondary,
  },
  deleteButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: WarmColors.border,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: `${WarmColors.error}05`,
  },
  deleteText: {
    ...Typography.caption,
    fontWeight: '600',
    color: WarmColors.error,
  },
  addButton: {
    backgroundColor: WarmColors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
    ...Elevation.level2,
  },
  addButtonText: {
    ...Typography.caption,
    fontWeight: '600',
    color: WarmColors.textOnPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: WarmColors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h3,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    ...Typography.body,
    color: WarmColors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
