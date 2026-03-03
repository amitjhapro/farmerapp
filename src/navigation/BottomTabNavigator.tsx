import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Text} from 'react-native';
import HomeScreen from '../screens/HomeScreen';

// Placeholder screens for now
const ProfileScreen = () => (
  <Text>Profile Screen</Text>
);
const SettingsScreen = () => (
  <Text>Settings Screen</Text>
);

export type BottomTabParamList = {
  HomeTab: undefined;
  ProfileTab: undefined;
  SettingsTab: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3478f6',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#eee',
          height: 60,
          paddingBottom: 8,
        },
      }}>
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarLabel: ({color}) => (
            <Text style={{color, fontSize: 12, marginTop: 4}}>Home</Text>
          ),
          tabBarIcon: ({color}) => (
            <Text style={{fontSize: 24, color}}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: ({color}) => (
            <Text style={{color, fontSize: 12, marginTop: 4}}>Profile</Text>
          ),
          tabBarIcon: ({color}) => (
            <Text style={{fontSize: 24, color}}>👤</Text>
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: ({color}) => (
            <Text style={{color, fontSize: 12, marginTop: 4}}>Settings</Text>
          ),
          tabBarIcon: ({color}) => (
            <Text style={{fontSize: 24, color}}>⚙️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
