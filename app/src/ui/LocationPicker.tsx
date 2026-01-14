/**
 * Location Picker Component
 * Allows users to select a location for geofence-based reminders
 *
 * Features:
 * - Use current location
 * - Adjust geofence radius (50m - 500m)
 * - Save selected location
 */

import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import {
  getCurrentLocation,
  requestLocationPermission,
  getLocationPermissionStatus,
} from '../native-bridge/LocationBridge';
import { LocationConfig } from '../domain';

interface LocationPickerProps {
  visible: boolean;
  onSave: (location: LocationConfig) => void;
  onCancel: () => void;
  initialLocation?: LocationConfig;
}

export default function LocationPicker({
  visible,
  onSave,
  onCancel,
  initialLocation,
}: LocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(initialLocation || null);
  const [radius, setRadius] = useState(initialLocation?.radius || 100);
  const [locationName, setLocationName] = useState(initialLocation?.name || '');

  useEffect(() => {
    if (visible && !initialLocation) {
      // Auto-load current location when picker opens
      loadCurrentLocation();
    }
  }, [visible]);

  const loadCurrentLocation = async () => {
    setLoading(true);

    try {
      // Check permission first
      const status = await getLocationPermissionStatus();

      if (status === 'not_determined') {
        // Request permission
        const newStatus = await requestLocationPermission();
        if (newStatus !== 'authorized_always' && newStatus !== 'authorized_when_in_use') {
          Alert.alert(
            'Permission Denied',
            'Location permission is required to create location-based reminders.'
          );
          setLoading(false);
          return;
        }
      } else if (status === 'denied' || status === 'restricted') {
        Alert.alert(
          'Location Access Needed',
          'Please enable location access in Settings to use location-based reminders.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                // TODO: Open iOS settings
                console.log('[LocationPicker] Open settings requested');
              },
            },
          ]
        );
        setLoading(false);
        return;
      }

      // Get current location
      const currentLocation = await getCurrentLocation();

      if (currentLocation) {
        setLocation({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        });
        setLocationName('Current Location');
      } else {
        Alert.alert('Error', 'Failed to get current location');
      }
    } catch (error) {
      console.error('[LocationPicker] Error loading location:', error);
      Alert.alert('Error', 'Failed to load location');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!location) {
      Alert.alert('No Location', 'Please select a location first');
      return;
    }

    const locationConfig: LocationConfig = {
      latitude: location.latitude,
      longitude: location.longitude,
      radius,
      name: locationName || 'My Location',
    };

    onSave(locationConfig);
  };

  const formatCoordinates = (lat: number, lon: number): string => {
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Location</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.saveButton}
            disabled={!location}
          >
            <Text
              style={[
                styles.saveButtonText,
                !location && styles.saveButtonTextDisabled,
              ]}
            >
              Save
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Location Name Input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Location Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Home, Office, Gym"
              value={locationName}
              onChangeText={setLocationName}
              placeholderTextColor="#999"
            />
          </View>

          {/* Current Location Button */}
          <TouchableOpacity
            style={styles.currentLocationButton}
            onPress={loadCurrentLocation}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#007AFF" />
            ) : (
              <>
                <Text style={styles.currentLocationIcon}>📍</Text>
                <Text style={styles.currentLocationText}>Use Current Location</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Selected Location Display */}
          {location && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Coordinates</Text>
              <View style={styles.coordinatesCard}>
                <Text style={styles.coordinatesText}>
                  {formatCoordinates(location.latitude, location.longitude)}
                </Text>
              </View>
            </View>
          )}

          {/* Radius Slider */}
          <View style={styles.section}>
            <View style={styles.radiusHeader}>
              <Text style={styles.sectionLabel}>Alert Radius</Text>
              <Text style={styles.radiusValue}>{radius}m</Text>
            </View>
            <Text style={styles.radiusDescription}>
              You'll be notified when you're within this distance
            </Text>

            {/* Simple Radius Selector (buttons instead of slider) */}
            <View style={styles.radiusButtons}>
              {[50, 100, 200, 500].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.radiusButton,
                    radius === r && styles.radiusButtonActive,
                  ]}
                  onPress={() => setRadius(r)}
                >
                  <Text
                    style={[
                      styles.radiusButtonText,
                      radius === r && styles.radiusButtonTextActive,
                    ]}
                  >
                    {r}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              We use geofencing, not continuous GPS tracking. Your location is only
              checked when entering the selected area.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  cancelButton: {
    paddingVertical: 8,
    minWidth: 60,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  saveButton: {
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  saveButtonTextDisabled: {
    color: '#CCCCCC',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  currentLocationButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  currentLocationIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  currentLocationText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  coordinatesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  coordinatesText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  radiusValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  radiusDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
  },
  radiusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  radiusButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  radiusButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  radiusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  radiusButtonTextActive: {
    color: '#007AFF',
  },
  infoBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    marginTop: 'auto',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
  },
});
