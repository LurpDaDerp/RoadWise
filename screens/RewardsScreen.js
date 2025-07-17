import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RewardsScreen({ route }) {
  const totalPoints = route.params?.totalPoints ?? 0;

  return (
    <View style={styles.container}>
      <Text style={styles.points}>Your Points: {totalPoints.toFixed(0)}</Text>
      <Text>Rewards store coming soon!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', color: 'white' },
  points: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: 'white' },
});