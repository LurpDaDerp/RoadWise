import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const leaderboard = [
  { id: 1, name: 'Alice', points: 1234 },
  { id: 2, name: 'Bob', points: 980 },
  { id: 3, name: 'You', points: 750 },
];

export default function LeaderboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>
      {leaderboard.map(user => (
        <Text key={user.id}>{user.name}: {user.points}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
});