// SettingsScreen.js
import React from 'react';
import {
  View, Text, StyleSheet, ImageBackground, TouchableOpacity, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const CATEGORIES = [
  { title: 'General', route: 'GeneralSettings' },
  { title: 'Dashboard', route: 'DashboardSettings' },
  { title: 'Drive Screen', route: 'DriveScreenSettings' },
  { title: 'Account', route: 'AccountSettings' },
];

export default function SettingsScreen() {
  const navigation = useNavigation();

  return (
    <ImageBackground source={require('../assets/settingsback.jpg')} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.openDrawer()}>
          <Ionicons name="menu" size={32} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.title}>Settings</Text>

        <FlatList
          data={CATEGORIES}
          keyExtractor={(item) => item.title}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => navigation.navigate(item.route)}

            >
              <Text style={styles.optionText}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  menuButton: { position: 'absolute', top: 70, left: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 45, marginBottom: 48, alignSelf: 'center' },
  optionRow: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: { fontSize: 18, color: '#fff' },
});
