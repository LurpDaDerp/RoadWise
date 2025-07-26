//StackNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import DashboardScreen from '../screens/DashboardScreen';
import DriveScreen from '../screens/DriveScreen';
import RewardsScreen from '../screens/RewardsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import SettingsStackNavigator from './SettingsStackNavigator';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';



const Stack = createStackNavigator();

export default function StackNavigator() {

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Drive"
        component={DriveScreen}
        options={{
          title: '',
          headerBackTitle: 'Complete Drive',
          headerShown: true,
          headerTransparent: true,
        }}
      />
      <Stack.Screen name="Rewards" component={RewardsScreen} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options = {{ headerTransparent: true, headerTitle: '', }}/>
      <Stack.Screen
        name="SettingsStack"
        component={SettingsStackNavigator}
        options={{ headerShown: false }}  
      />
      <Stack.Screen name="Login" component={LoginScreen} options = {{ headerTransparent: true, headerTitle: '', }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options = {{ headerTransparent: true, headerTitle: '', }} />
    </Stack.Navigator>
  );
}
