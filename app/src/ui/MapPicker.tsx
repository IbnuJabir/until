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
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import {
  getCurrentLocation,
  requestLocationPermission,
  getLocationPermissionStatus,
} from '../native-bridge/LocationBridge';
import { LocationConfig } from '../domain/types';

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
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Location</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
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
                    fillColor="rgba(0, 122, 255, 0.2)"
                    strokeColor="rgba(0, 122, 255, 0.8)"
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
            <Text style={styles.radiusLabel}>Detection Radius: {radius}m</Text>
            <View style={styles.radiusButtons}>
              <TouchableOpacity
                style={[styles.radiusButton, radius <= MIN_RADIUS && styles.radiusButtonDisabled]}
                onPress={decreaseRadius}
                disabled={radius <= MIN_RADIUS}
              >
                <Text style={styles.radiusButtonText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.radiusButton, radius >= MAX_RADIUS && styles.radiusButtonDisabled]}
                onPress={increaseRadius}
                disabled={radius >= MAX_RADIUS}
              >
                <Text style={styles.radiusButtonText}>+</Text>
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
              <TouchableOpacity onPress={loadCurrentLocation} style={styles.currentLocationButton}>
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
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  controls: {
    padding: 20,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  radiusContainer: {
    marginBottom: 16,
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  radiusButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  radiusButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  radiusButtonDisabled: {
    backgroundColor: '#ccc',
  },
  radiusButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  coordsContainer: {
    alignItems: 'center',
  },
  coordsText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  currentLocationButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  currentLocationText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});
