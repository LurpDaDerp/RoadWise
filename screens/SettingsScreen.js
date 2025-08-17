import React, { useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ImageBackground, TouchableOpacity, FlatList, Dimensions, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const CATEGORIES = [
  { title: 'General', route: 'GeneralSettings' },
  { title: 'Safety', route: 'SafetySettings' },
  { title: 'Drive Screen', route: 'DriveScreenSettings' },
  { title: 'Account', route: 'AccountSettings' },
];

const { width, height } = Dimensions.get('window');

export default function SettingsScreen() {
  const navigation = useNavigation();
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const fadeInContent = useCallback(() => {
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.poly(3)),
      useNativeDriver: true,
    }).start();
  }, [contentOpacity]);

  useFocusEffect(
    useCallback(() => {
      contentOpacity.setValue(0); // reset opacity
      fadeInContent(); // animate fade-in
    }, [fadeInContent])
  );

  return (
    <ImageBackground
      source={require('../assets/settingsback.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <Animated.View style={[styles.overlay, { opacity: contentOpacity }]}>
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
      </Animated.View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { 
    flex: 1, 
    padding: 0.07 * width, 
    backgroundColor: 'rgba(0, 0, 0, 0.3)' 
  },
  title: {
    fontSize: width / (375 / 32),
    fontWeight: 'bold',
    color: '#fff',
    marginTop: height / (667 / 45),
    marginBottom: height / (667 / 32),
    alignSelf: 'center',
  },
  optionRow: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.17)',
    marginBottom: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: { 
    fontSize: 18, 
    color: '#fff' 
  },
});
