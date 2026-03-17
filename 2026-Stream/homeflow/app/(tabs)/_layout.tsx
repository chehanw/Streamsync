import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/lib/theme/ThemeContext';

export default function TabLayout() {
  const { theme } = useAppTheme();
  const { isDark, colors } = theme;

  const activeTint = colors.accent;
  const inactiveTint = '#8E8E93';
  const tabBarBg = isDark ? '#1C1C1E' : '#F2F2F7';
  const tabBarBorder = isDark ? '#38383A' : '#C6C6C8';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopColor: tabBarBorder,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="voiding"
        options={{
          title: 'Voiding',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="drop.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: 'Health',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="heart.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: 'Tracker',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="checklist" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat Helper',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="message.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.fill" color={color} />,
        }}
      />

      {/* Hide old tabs that still have files — prevents expo-router from auto-adding them */}
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="contacts" options={{ href: null }} />
      <Tabs.Screen name="schedule" options={{ href: null }} />
      <Tabs.Screen name="recovery" options={{ href: null }} />
    </Tabs>
  );
}
