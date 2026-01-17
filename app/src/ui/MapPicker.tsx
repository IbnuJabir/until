/**
 * Map-based location picker using react-native-maps
 * Allows users to select a location visually on Apple Maps
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import {
  getCurrentLocation,
  requestLocationPermission,
  getLocationPermissionStatus,
} from '../native-bridge/LocationBridge';
import { LocationConfig } from '../domain/types';
import { WarmColors, Elevation, Spacing, BorderRadius, Typography } from '@/constants/theme';

interface MapPickerProps {
  visible: boolean;
  onSave: (location: LocationConfig & { name: string }) => void;
  onCancel: () => void;
  initialLocation?: {
    latitude: number;
    longitude: number;
    radius?: number;
    name?: string;
  };
}

const DEFAULT_RADIUS = 100; // meters
const MIN_RADIUS = 50;
const MAX_RADIUS = 500;

export default function MapPicker({
  visible,
  onSave,
  onCancel,
  initialLocation,
}: MapPickerProps) {
  const mapRef = useRef<MapView>(null);

  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialLocation || null);

  const [radius, setRadius] = useState(initialLocation?.radius || DEFAULT_RADIUS);
  const [placeName, setPlaceName] = useState(initialLocation?.name || '');
  const [isLoading, setIsLoading] = useState(false);

  // Load user's current location on mount
  useEffect(() => {
    if (visible && !initialLocation) {
      loadCurrentLocation();
    }
  }, [visible]);

  const loadCurrentLocation = async () => {
    setIsLoading(true);

    try {
      const status = await getLocationPermissionStatus();

      if (status === 'not_determined') {
        const granted = await requestLocationPermission();
        if (!granted) {
          Alert.alert(
            'Location Permission Required',
            'Please enable location access to use the map picker.'
          );
          setIsLoading(false);
          return;
        }
      } else if (status === 'denied') {
        Alert.alert(
          'Location Permission Denied',
          'Please enable location access in Settings to use the map picker.'
        );
        setIsLoading(false);
        return;
      }

      const location = await getCurrentLocation();

      if (location) {
        setSelectedLocation({
          latitude: location.latitude,
          longitude: location.longitude,
        });

        // Animate map to user's location
        mapRef.current?.animateToRegion(
          {
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500
        );
      }
    } catch (error) {
      console.error('[MapPicker] Failed to load location:', error);
      Alert.alert('Error', 'Failed to load your current location.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapPress = (event: any) => {
    const coordinate = event.nativeEvent.coordinate;
    setSelectedLocation({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    });
  };

  const handleSave = () => {
    if (!selectedLocation) {
      Alert.alert('No Location Selected', 'Please select a location on the map.');
      return;
    }

    if (!placeName.trim()) {
      Alert.alert('Place Name Required', 'Please enter a name for this location.');
      return;
    }

    onSave({
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      radius,
      name: placeName.trim(),
    });

    // Reset state
    setSelectedLocation(null);
    setPlaceName('');
    setRadius(DEFAULT_RADIUS);
  };

  const handleCancel = () => {
    // Reset state
    setSelectedLocation(null);
    setPlaceName('');
    setRadius(DEFAULT_RADIUS);
    onCancel();
  };

  const increaseRadius = () => {
    setRadius((prev) => Math.min(prev + 50, MAX_RADIUS));
  };

  const decreaseRadius = () => {
    setRadius((prev) => Math.max(prev - 50, MIN_RADIUS));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton} activeOpacity={0.7}>
            <MaterialIcons name="close" size={24} color={WarmColors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Location</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton} activeOpacity={0.7}>
            <MaterialIcons name="check" size={24} color={WarmColors.primary} />
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={WarmColors.primary} />
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_DEFAULT} // Use Apple Maps on iOS
              showsUserLocation
              showsMyLocationButton
              onPress={handleMapPress}
              initialRegion={{
                latitude: selectedLocation?.latitude || 37.78825,
                longitude: selectedLocation?.longitude || -122.4324,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              {selectedLocation && (
                <>
                  <Marker
                    coordinate={selectedLocation}
                    draggable
                    onDragEnd={(event) => {
                      setSelectedLocation(event.nativeEvent.coordinate);
                    }}
                  />
                  <Circle
                    center={selectedLocation}
                    radius={radius}
                    fillColor={`${WarmColors.primary}30`}
                    strokeColor={WarmColors.primary}
                    strokeWidth={2}
                  />
                </>
              )}
            </MapView>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Place Name Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Place Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Home, Office, Gym"
              value={placeName}
              onChangeText={setPlaceName}
              autoCapitalize="words"
            />
          </View>

          {/* Radius Control */}
          <View style={styles.radiusContainer}>
            <View style={styles.radiusHeader}>
              <MaterialIcons name="radio-button-unchecked" size={16} color={WarmColors.primary} />
              <Text style={styles.radiusLabel}>Detection Radius: {radius}m</Text>
            </View>
            <View style={styles.radiusButtons}>
              <TouchableOpacity
                style={[styles.radiusButton, radius <= MIN_RADIUS && styles.radiusButtonDisabled]}
                onPress={decreaseRadius}
                disabled={radius <= MIN_RADIUS}
                activeOpacity={0.7}
              >
                <MaterialIcons 
                  name="remove" 
                  size={20} 
                  color={radius <= MIN_RADIUS ? WarmColors.textTertiary : WarmColors.textOnPrimary} 
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.radiusButton, radius >= MAX_RADIUS && styles.radiusButtonDisabled]}
                onPress={increaseRadius}
                disabled={radius >= MAX_RADIUS}
                activeOpacity={0.7}
              >
                <MaterialIcons 
                  name="add" 
                  size={20} 
                  color={radius >= MAX_RADIUS ? WarmColors.textTertiary : WarmColors.textOnPrimary} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Instructions */}
          {!selectedLocation && !isLoading && (
            <Text style={styles.instructionText}>
              Tap anywhere on the map to select a location
            </Text>
          )}

          {selectedLocation && (
            <View style={styles.coordsContainer}>
              <Text style={styles.coordsText}>
                {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </Text>
              <TouchableOpacity 
                onPress={loadCurrentLocation} 
                style={styles.currentLocationButton}
                activeOpacity={0.8}
              >
                <MaterialIcons name="my-location" size={18} color={WarmColors.primary} />
                <Text style={styles.currentLocationText}>Use Current Location</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WarmColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: WarmColors.border,
    backgroundColor: WarmColors.background,
    ...Elevation.level1,
  },
  headerTitle: {
    ...Typography.h4,
    color: WarmColors.textPrimary,
  },
  cancelButton: {
    paddingVertical: Spacing.xs,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    paddingVertical: Spacing.xs,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    color: WarmColors.textSecondary,
  },
  controls: {
    padding: Spacing.md,
    backgroundColor: WarmColors.surfaceVariant,
    borderTopWidth: 1,
    borderTopColor: WarmColors.border,
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.caption,
    color: WarmColors.textPrimary,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: WarmColors.background,
    borderWidth: 1,
    borderColor: WarmColors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
    color: WarmColors.textPrimary,
  },
  radiusContainer: {
    marginBottom: Spacing.md,
  },
  radiusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  radiusLabel: {
    ...Typography.caption,
    color: WarmColors.textPrimary,
    fontWeight: '600',
  },
  radiusButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  radiusButton: {
    flex: 1,
    backgroundColor: WarmColors.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.level1,
  },
  radiusButtonDisabled: {
    backgroundColor: WarmColors.textTertiary,
  },
  instructionText: {
    ...Typography.caption,
    color: WarmColors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  coordsContainer: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  coordsText: {
    ...Typography.small,
    color: WarmColors.textTertiary,
    marginBottom: Spacing.sm,
    fontFamily: 'monospace',
  },
  currentLocationButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: `${WarmColors.primary}15`,
    borderRadius: BorderRadius.sm,
  },
  currentLocationText: {
    ...Typography.caption,
    color: WarmColors.primary,
    fontWeight: '600',
  },
});
