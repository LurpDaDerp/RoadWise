import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FoodRewardsScreen from '../screens/FoodRewardsScreen';
import ShoppingRewardsScreen from '../screens/ShoppingRewardsScreen';
import GamesRewardsScreen from '../screens/GamesRewardsScreen';
import SubscriptionsRewardsScreen from '../screens/SubscriptionsRewardsScreen';

const Stack = createNativeStackNavigator();

export default function RewardsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="FoodRewards" component={FoodRewardsScreen} options = {{ headerTransparent: true, headerTitle: '', }} />
      <Stack.Screen name="ShoppingRewards" component={ShoppingRewardsScreen} options = {{ headerTransparent: true, headerTitle: '', }} />
      <Stack.Screen name="GamesRewards" component={GamesRewardsScreen} options = {{ headerTransparent: true, headerTitle: '', }} />
      <Stack.Screen name="SubscriptionsRewards" component={SubscriptionsRewardsScreen} options = {{ headerTransparent: true, headerTitle: '', }} />
    </Stack.Navigator>
  );
}
