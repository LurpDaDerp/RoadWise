import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DashboardSettings() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Dashboard Settings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  text: {
    fontSize: 24,
    color: '#fff',
  },
});
