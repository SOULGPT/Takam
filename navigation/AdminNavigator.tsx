import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';

import AdminDashboard from '../screens/admin/AdminDashboard';
import AdminUsers from '../screens/admin/AdminUsers';
import AdminGifts from '../screens/admin/AdminGifts';
import AdminSupport from '../screens/admin/AdminSupport';

const Tab = createBottomTabNavigator();

export default function AdminNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#1A1D2B' },
        headerTintColor: '#FDFAF4',
        headerTitleStyle: { fontWeight: '800' },
        tabBarStyle: {
          backgroundColor: '#1A1D2B',
          borderTopWidth: 0,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 84 : 64,
        },
        tabBarActiveTintColor: '#C9705A',
        tabBarInactiveTintColor: '#61688B',
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdminDashboard}
        options={{
          tabBarIcon: () => null,
          tabBarLabel: '📊 Analytics',
        }}
      />
      <Tab.Screen
        name="CRM"
        component={AdminUsers}
        options={{
          tabBarIcon: () => null,
          tabBarLabel: '👥 Users',
        }}
      />
      <Tab.Screen
        name="Gifts"
        component={AdminGifts}
        options={{
          tabBarIcon: () => null,
          tabBarLabel: '📦 Orders',
        }}
      />
      <Tab.Screen
        name="Support"
        component={AdminSupport}
        options={{
          tabBarIcon: () => null,
          tabBarLabel: '✉️ Inbox',
        }}
      />
    </Tab.Navigator>
  );
}
