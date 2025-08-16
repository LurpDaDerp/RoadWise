// App.js
import React, { useRef } from 'react';
import { AppState, useColorScheme, Dimensions } from 'react-native';
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
import MyDrivesScreen from './screens/MyDrivesScreen';
import RewardsStackNavigator from './navigation/RewardsStackNavigator';
import LeaderboardScreen from './screens/LeaderboardScreen';
import AboutScreen from './screens/AboutScreen';

import { ThemeProvider } from './context/ThemeContext';
import { useContext } from 'react';
import { ThemeContext } from './context/ThemeContext';
import { DriveProvider } from './context/DriveContext'

import { Provider as PaperProvider } from 'react-native-paper';

import * as Notifications from 'expo-notifications';
import RewardsScreen from './screens/RewardsScreen';


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, 
    shouldShowList: true,   
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
const Drawer = createDrawerNavigator();

const { width, height } = Dimensions.get('window');

function AppNavigation() {
  const { resolvedTheme } = useContext(ThemeContext);
  const appState = useRef(AppState.currentState);
  const navigationRef = useNavigationContainerRef();

  React.useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Notification permissions not granted!');
      }
    })();
  }, []);

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

      <Drawer.Navigator 
        initialRouteName="Home"
        screenOptions={{
          drawerStyle: {
            width: width,
          },
          swipeEnabled: false
        }}
      >
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

        {/* <Drawer.Screen
          name="My Drives"
          component={MyDrivesScreen}
          options={{
            headerShown: false,
            drawerIcon: ({ color, size }) => (
              <MaterialIcons name="directions-car" size={size} color={color} />
            ),
          }}
        /> */}

        <Drawer.Screen
          name="Rewards"
          component={RewardsStackNavigator}
          options={{
            headerShown: false,
            drawerIcon: ({ color, size }) => (
              <MaterialIcons name="card-giftcard" size={size} color={color} />
            ),
          }}
        />

        <Drawer.Screen
          name="Leaderboard"
          component={LeaderboardScreen}
          options={{
            headerShown: false,
            drawerIcon: ({ color, size }) => (
              <MaterialIcons name="leaderboard" size={size} color={color} />
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
        
        
        <Drawer.Screen
          name="About"
          component={AboutScreen}
          options={{
            headerShown: false,
            drawerIcon: ({ color, size }) => (
              <MaterialIcons name="info-outline" size={size} color={color} />
            ),
          }}
        />

        
        
      </Drawer.Navigator>
    </NavigationContainer>
  );
}



export default function App() {
  return (
    <DriveProvider>
      <ThemeProvider>
        <PaperProvider>
          <AppNavigation />
        </PaperProvider>
      </ThemeProvider>
    </DriveProvider>
  );
}