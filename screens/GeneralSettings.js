import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Dimensions, ImageBackground, Switch, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';


const { width, height } = Dimensions.get('window');

const STORAGE_KEYS = {
  appTheme: '@appTheme',
  exampleToggle: '@exampleToggle',
};

export default function GeneralSettings() {
  const { theme, updateTheme } = useContext(ThemeContext);
  const [exampleToggle, setExampleToggle] = useState(false);

  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === 'dark';

  const backgroundColor = isDark ? '#0e0e0eff' : '#fff';
  const titleColor = isDark ? '#fff' : '#000';
  const textColor = isDark ? '#fff' : '#000';
  const moduleBackground = isDark ? '#222' : '#ebebebff';
  const altTextColor = isDark ? '#aaa' : '#555';
  const inputbackground = isDark? '#353535ff' : '#a7a7a78e';

  const themeSegments = ['Light', 'Dark', 'System'];

  useEffect(() => {
    (async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(STORAGE_KEYS.appTheme);
        if (storedTheme && themeSegments.map(s => s.toLowerCase()).includes(storedTheme)) {
          updateTheme(storedTheme);
        }

        const storedToggle = await AsyncStorage.getItem(STORAGE_KEYS.exampleToggle);
        if (storedToggle !== null) setExampleToggle(storedToggle === 'true');
      } catch (e) {
        console.warn('⚠️ Failed to load settings:', e);
      }
    })();
  }, []);

  

  const onThemeChange = async (index) => {
    const selected = themeSegments[index].toLowerCase();
    updateTheme(selected); 
  };

  const toggleExample = async (value) => {
    setExampleToggle(value);
    await AsyncStorage.setItem(STORAGE_KEYS.exampleToggle, value.toString());
  };

  return (
    <ScrollView style={[styles.background, {backgroundColor: backgroundColor}]}>
      <View style={styles.overlay}>
        <Text style={[styles.title, {color: titleColor}]}>General Settings</Text>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, {color: textColor}]}>Appearance</Text>
          <SegmentedControl
            values={themeSegments}
            selectedIndex={themeSegments.indexOf(theme.charAt(0).toUpperCase() + theme.slice(1))}
            onChange={(event) => onThemeChange(event.nativeEvent.selectedSegmentIndex)}
            style={styles.segmentedControl}
          />
        </View>

        <View style={styles.settingRowToggle}>
          <Text style={[styles.settingLabel, {color: textColor}]}>Example Toggle</Text>
          <Switch
            value={exampleToggle}
            onValueChange={toggleExample}
            trackColor={{ false: '#767577', true: '#86ff7d' }}
            thumbColor={exampleToggle ? '#ffffff' : '#f4f3f4'}
          />
        </View>


      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, padding: width / (375 / 24), backgroundColor: 'rgba(0, 0, 0, 0)' },
  title: {
    fontSize: width / (375 / 32),
    fontWeight: 'bold',
    marginTop: height / (667 / 60),
    marginBottom: height / (667 / 32),
    alignSelf: 'center',
  },
  settingRow: {
    marginBottom: width / (375 / 16),
  },
  settingRowToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: width / (375 / 16),
  },
  settingLabel: {
    fontSize: width / (375 / 16),
    marginBottom: 12,
  },
  segmentedControl: {
    height: 40,
  },
});
