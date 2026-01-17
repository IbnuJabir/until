import { Tabs } from 'expo-router';
import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { HapticTab } from '@/components/haptic-tab';
import { WarmColors, Elevation } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: WarmColors.primary,
        tabBarInactiveTintColor: WarmColors.textTertiary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: WarmColors.background,
          borderTopWidth: 1,
          borderTopColor: WarmColors.border,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
          ...Elevation.level2,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Reminders',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="notifications" size={size || 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="explore" size={size || 24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
