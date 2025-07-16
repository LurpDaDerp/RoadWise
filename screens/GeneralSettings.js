import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function GeneralSettings() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>General Settings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222', // dark background to match your theme
  },
  text: {
    fontSize: 24,
    color: '#fff',
  },
});
