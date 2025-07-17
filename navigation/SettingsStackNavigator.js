import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsScreen from '../screens/SettingsScreen';  
import DriveScreenSettings from '../screens/DriveScreenSettings'; 
import GeneralSettings from '../screens/GeneralSettings'; 
import DashboardSettings from '../screens/DashboardSettings';
import AccountSettings from '../screens/AccountSettings';

const Stack = createNativeStackNavigator();


export default function SettingsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="DriveScreenSettings" 
        component={DriveScreenSettings}
        options = {{ headerTransparent: true, headerTitle: '', }}
      />
      <Stack.Screen 
        name="GeneralSettings" 
        component={GeneralSettings} 
        options = {{ headerTransparent: true, headerTitle: '', }}
      />
      <Stack.Screen 
        name="DashboardSettings" 
        component={DashboardSettings} 
        options = {{ headerTransparent: true, headerTitle: '', }}
      />
      <Stack.Screen 
        name="AccountSettings" 
        component={AccountSettings} 
        options = {{ headerTransparent: true, headerTitle: '', }}
      />
    </Stack.Navigator>
  );
}
