import React, { useRef, useCallback, useContext } from 'react';
import {
  View, Text, StyleSheet, ImageBackground, TouchableOpacity, FlatList, Dimensions, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';

const CATEGORIES = [
  { title: 'General', route: 'GeneralSettings' },
  { title: 'Safety', route: 'SafetySettings' },
  { title: 'Driving', route: 'DriveScreenSettings' },
  { title: 'Account', route: 'AccountSettings' },
];

const { width, height } = Dimensions.get('window');

export default function SettingsScreen() {
  const navigation = useNavigation();
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === 'dark';
  
  const backgroundColor = isDark ? '#0e0e0eff' : '#fff';
  const titleColor = isDark ? '#fff' : '#000';
  const textColor = isDark ? '#fff' : '#000';
  const moduleBackground = isDark ? '#222' : '#ebebebff';
  const altTextColor = isDark ? '#aaa' : '#555';
  const inputbackground = isDark? '#353535ff' : '#a7a7a78e';

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
    <View style={[styles.background, {backgroundColor: backgroundColor}]}>
      <Animated.View style={[styles.overlay, { opacity: contentOpacity }]}>
        <Text style={[styles.title, {color: titleColor}]}>Settings</Text>

        <FlatList
          data={CATEGORIES}
          keyExtractor={(item) => item.title}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.optionRow, {backgroundColor: moduleBackground}]}
              onPress={() => navigation.navigate(item.route)}
            >
              <Text style={[styles.optionText, {color: textColor}]}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { 
    flex: 1, 
    padding: 0.07 * width, 
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
    fontSize: 16, 
    color: '#fff' 
  },
});
