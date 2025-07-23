import React, { useRef } from 'react';
import { useFocusEffect, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsScreen from '../screens/SettingsScreen';
import DriveScreenSettings from '../screens/DriveScreenSettings';
import GeneralSettings from '../screens/GeneralSettings';
import DashboardSettings from '../screens/DashboardSettings';
import AccountSettings from '../screens/AccountSettings';

const Stack = createNativeStackNavigator();

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
        options={{ headerShown: false, headerTitle: '' }}
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
        name="DashboardSettings"
        component={DashboardSettings}
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
