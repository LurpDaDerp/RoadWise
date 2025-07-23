// App.js
import React, { useRef } from 'react';
import { AppState, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NavigationContainer,
  useNavigationContainerRef,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { MaterialIcons } from '@expo/vector-icons'; 

import StackNavigator from './navigation/StackNavigator';
import SettingsStackNavigator from './navigation/SettingsStackNavigator';

import { ThemeProvider } from './context/ThemeContext';
import { useContext } from 'react';
import { ThemeContext } from './context/ThemeContext';


const Drawer = createDrawerNavigator();

function AppNavigation() {
  const { resolvedTheme } = useContext(ThemeContext);
  const appState = useRef(AppState.currentState);
  const navigationRef = useNavigationContainerRef();

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        await AsyncStorage.setItem('lastBackgroundTime', Date.now().toString());
      }

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const stored = await AsyncStorage.getItem('lastBackgroundTime');
        const now = Date.now();

        if (stored) {
          const diffMinutes = (now - parseInt(stored, 10)) / 1000 / 60;
          if (diffMinutes >= 10 && navigationRef.isReady()) {
            navigationRef.reset({
              index: 0,
              routes: [
                {
                  name: 'Home',
                  state: {
                    routes: [{ name: 'Dashboard' }],
                  },
                },
              ],
            });
          }
        }
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [navigationRef]);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}
    >

      <Drawer.Navigator initialRouteName="Home">
        <Drawer.Screen
          name="Home"
          component={StackNavigator}
          options={{
            headerShown: false,
            drawerIcon: ({ color, size }) => (
              <MaterialIcons name="home" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="Settings"
          component={SettingsStackNavigator}
          options={{
            headerShown: false,
            drawerIcon: ({ color, size }) => (
              <MaterialIcons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}


export default function App() {
  return (
    <ThemeProvider>
      <AppNavigation />
    </ThemeProvider>
  );
}