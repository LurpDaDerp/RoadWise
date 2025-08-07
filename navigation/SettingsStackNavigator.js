import React, { useRef } from 'react';
import { useFocusEffect, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import SettingsScreen from '../screens/SettingsScreen';
import DriveScreenSettings from '../screens/DriveScreenSettings';
import GeneralSettings from '../screens/GeneralSettings';
import SafetySettings from '../screens/SafetySettings'
import AccountSettings from '../screens/AccountSettings';

const Stack = createStackNavigator();

export default function SettingsStackNavigator() {
  const navigationRef = useNavigationContainerRef();
  const hasReset = useRef(false); 

  useFocusEffect(
    React.useCallback(() => {
      if (!hasReset.current && navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'SettingsMain' }],
        });
        hasReset.current = true;
      }

      return () => {
        hasReset.current = false;
      };
    }, [navigationRef])
  );

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ headerShown: false, headerTitle: "Settings" }}
      />
      <Stack.Screen
        name="DriveScreenSettings"
        component={DriveScreenSettings}
        options={{ headerTransparent: true, headerTitle: '' }}
      />
      <Stack.Screen
        name="GeneralSettings"
        component={GeneralSettings}
        options={{ headerTransparent: true, headerTitle: '' }}
      />
      <Stack.Screen
        name="SafetySettings"
        component={SafetySettings}
        options={{ headerTransparent: true, headerTitle: '' }}
      />
      <Stack.Screen
        name="AccountSettings"
        component={AccountSettings}
        options={{ headerTransparent: true, headerTitle: '' }}
      />
    </Stack.Navigator>
  );
}
