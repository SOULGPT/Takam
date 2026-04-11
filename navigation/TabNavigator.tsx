import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet, View } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import ConnectionsScreen from '../screens/ConnectionsScreen';
import GiftScreen from '../screens/GiftScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SyncLinkScreen from '../screens/SyncLinkScreen';
import { useStore } from '../store/useStore';
import { shadow } from '../lib/theme/shadows';

const Tab = createBottomTabNavigator();

const icons: Record<string, string> = {
  Home: '🌸',
  SyncLink: '🗓️',
  Bridge: '📍',
  Connections: '👥',
  Gift: '🎁',
  Profile: '✦',
};

export default function TabNavigator() {
  const bonds = useStore((s) => s.bonds);
  const pendingCount = bonds.filter((b) => b.status === 'pending').length;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#C9705A',
        tabBarInactiveTintColor: '#B5947A',
        tabBarLabel: ({ focused, color }) => (
          <Text style={[styles.label, { color }]}>{route.name}</Text>
        ),
        tabBarIcon: ({ focused }) => (
          <View>
            <Text style={[styles.icon, focused && styles.iconActive]}>
              {icons[route.name]}
            </Text>
            {route.name === 'Connections' && pendingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="SyncLink" component={SyncLinkScreen} options={{ tabBarLabel: 'Sync-Link' }} />
      <Tab.Screen name="Bridge" component={MapScreen} />
      <Tab.Screen name="Connections" component={ConnectionsScreen} />
      <Tab.Screen name="Gift" component={GiftScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FDFAF4',
    borderTopWidth: 1,
    borderTopColor: '#EDD9B8',
    paddingTop: 6,
    paddingBottom: 4,
    height: 68,
    ...shadow('#3D2B1F', { width: 0, height: -4 }, 0.06, 12, 8),
  },
  icon: {
    fontSize: 22,
    opacity: 0.5,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#C9705A',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FDFAF4',
  },
  badgeText: {
    color: '#FDFAF4',
    fontSize: 9,
    fontWeight: '800',
  },
});
