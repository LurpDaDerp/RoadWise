import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ImageBackground, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

const STORAGE_KEYS = {
  appTheme: '@appTheme',
  exampleToggle: '@exampleToggle',
};

export default function GeneralSettings() {
  const [exampleToggle, setExampleToggle] = useState(false);

  const themeSegments = ['Light', 'Dark', 'System'];

  useEffect(() => {
    (async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(STORAGE_KEYS.appTheme);
        if (storedTheme && themeSegments.map(s => s.toLowerCase()).includes(storedTheme)) {
          setTheme(storedTheme);
        }

        const storedToggle = await AsyncStorage.getItem(STORAGE_KEYS.exampleToggle);
        if (storedToggle !== null) setExampleToggle(storedToggle === 'true');
      } catch (e) {
        console.warn('⚠️ Failed to load settings:', e);
      }
    })();
  }, []);

  const { theme, updateTheme } = useContext(ThemeContext);

  const onThemeChange = async (index) => {
    const selected = themeSegments[index].toLowerCase();
    updateTheme(selected); 
  };

  const toggleExample = async (value) => {
    setExampleToggle(value);
    await AsyncStorage.setItem(STORAGE_KEYS.exampleToggle, value.toString());
  };

  return (
    <ImageBackground source={require('../assets/settingsback.jpg')} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <Text style={styles.title}>General Settings</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Appearance</Text>
          <SegmentedControl
            values={themeSegments}
            selectedIndex={themeSegments.indexOf(theme.charAt(0).toUpperCase() + theme.slice(1))}
            onChange={(event) => onThemeChange(event.nativeEvent.selectedSegmentIndex)}
            style={styles.segmentedControl}
          />
        </View>

        <View style={styles.settingRowToggle}>
          <Text style={styles.settingLabel}>Example Toggle</Text>
          <Switch
            value={exampleToggle}
            onValueChange={toggleExample}
            trackColor={{ false: '#767577', true: '#86ff7d' }}
            thumbColor={exampleToggle ? '#ffffff' : '#f4f3f4'}
          />
        </View>


      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  title: { 
    fontSize: 36, 
    fontWeight: 'bold', 
    color: '#fff', 
    marginTop: 50, 
    marginBottom: 48, 
    alignSelf: 'center' 
  },
  settingRow: { 
    marginBottom: 20 
  },
  settingRowToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingLabel: { 
    fontSize: 18, 
    marginBottom: 12, 
    color: '#fff' 
  },
  segmentedControl: { 
    height: 40 
  },
});
