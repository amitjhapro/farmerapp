import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createDrawerNavigator} from '@react-navigation/drawer';
import {enableScreens} from 'react-native-screens';

import LoginScreen from '../screens/LoginScreen';
import DrawerContent from './DrawerContent';
import BottomTabNavigator from './BottomTabNavigator';

const FarmerOnboardingScreen = require('../screens/FarmerOnboardingScreen').default;

export type RootStackParamList = {
  Login: undefined;
  MainApp: undefined;
  Onboarding: undefined;
};

export type DrawerParamList = {
  Tabs: undefined;
  Onboarding: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

// performance optimization
enableScreens();

const DrawerNavigator: React.FC = () => {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
      }}
      drawerContent={(props) => <DrawerContent {...props} />}>
      <Drawer.Screen name="Tabs" component={BottomTabNavigator} />
      <Drawer.Screen
        name="Onboarding"
        component={FarmerOnboardingScreen}
        options={{title: 'Farmer Onboarding'}}
      />
    </Drawer.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="MainApp"
          component={DrawerNavigator}
          options={{headerShown: false}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
