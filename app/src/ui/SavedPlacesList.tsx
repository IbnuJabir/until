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
import { SavedPlace } from '../domain/types';
import { useReminderStore } from '../store/reminderStore';

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
          activeOpacity={0.7}
        >
          <View style={styles.placeHeader}>
            {item.icon && <Text style={styles.placeIcon}>{item.icon}</Text>}
            <View style={styles.placeInfo}>
              <Text style={styles.placeName}>{item.name}</Text>
              {item.address && <Text style={styles.placeAddress}>{item.address}</Text>}
              <Text style={styles.placeDetails}>
                Radius: {item.radius}m • Used {item.usageCount} {item.usageCount === 1 ? 'time' : 'times'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeletePlace(item)}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No Saved Places</Text>
      <Text style={styles.emptyText}>
        Add your first location to quickly create location-based reminders
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select a Place</Text>
        <Text style={styles.headerSubtitle}>
          Choose from your saved locations or add a new one
        </Text>
      </View>

      <FlatList
        data={savedPlaces}
        renderItem={renderPlaceItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
      />

      <TouchableOpacity style={styles.addButton} onPress={onAddNewPlace}>
        <Text style={styles.addButtonText}>+ Add New Place</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  placeCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  placeContent: {
    padding: 16,
  },
  placeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  placeIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  placeAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  placeDetails: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FF3B30',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
