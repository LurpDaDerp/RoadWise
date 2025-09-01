import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Switch, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { ThemeContext } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const STORAGE_KEYS = {
  speedUnit: '@speedUnit',
  warningsEnabled: '@speedingWarningsEnabled',
  showCurrentSpeed: '@showCurrentSpeed',
  showSpeedLimit: '@showSpeedLimit',
  displayTotalPoints: '@displayTotalPoints',
  distractedNotificationsEnabled: '@distractedNotificationsEnabled',
  audioSpeedUpdatesEnabled: '@audioSpeedUpdatesEnabled',
};

export default function DriveScreenSettings() {
  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === 'dark';

  const backgroundColor = isDark ? '#0e0e0eff' : '#fff';
  const titleColor = isDark ? '#fff' : '#000';
  const textColor = isDark ? '#fff' : '#000';
  const moduleBackground = isDark ? '#222' : '#ebebebff';
  const altTextColor = isDark ? '#aaa' : '#555';

  const [speedUnit, setSpeedUnit] = useState('mph');
  const [warningsEnabled, setWarningsEnabled] = useState(true);
  const [showCurrentSpeed, setShowCurrentSpeed] = useState(true);
  const [showSpeedLimit, setShowSpeedLimit] = useState(true);
  const [displayTotalPoints, setDisplayTotalPoints] = useState(false);
  const [distractedNotificationsEnabled, setDistractedNotificationsEnabled] = useState(true);
  const [audioSpeedUpdatesEnabled, setAudioSpeedUpdatesEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedUnit = await AsyncStorage.getItem(STORAGE_KEYS.speedUnit);
        if (storedUnit === 'mph' || storedUnit === 'kph') setSpeedUnit(storedUnit);

        const storedWarnings = await AsyncStorage.getItem(STORAGE_KEYS.warningsEnabled);
        if (storedWarnings !== null) setWarningsEnabled(storedWarnings === 'true');

        const storedShowCurrentSpeed = await AsyncStorage.getItem(STORAGE_KEYS.showCurrentSpeed);
        if (storedShowCurrentSpeed !== null) setShowCurrentSpeed(storedShowCurrentSpeed === 'true');

        const storedShowSpeedLimit = await AsyncStorage.getItem(STORAGE_KEYS.showSpeedLimit);
        if (storedShowSpeedLimit !== null) setShowSpeedLimit(storedShowSpeedLimit === 'true');

        const storedDisplayMode = await AsyncStorage.getItem(STORAGE_KEYS.displayTotalPoints);
        if (storedDisplayMode !== null) setDisplayTotalPoints(storedDisplayMode === 'true');

        const storedDistracted = await AsyncStorage.getItem(STORAGE_KEYS.distractedNotificationsEnabled);
        if (storedDistracted !== null) setDistractedNotificationsEnabled(storedDistracted === 'true');

        const storedAudioSpeedUpdates = await AsyncStorage.getItem(STORAGE_KEYS.audioSpeedUpdatesEnabled);
        if (storedAudioSpeedUpdates !== null) setAudioSpeedUpdatesEnabled(storedAudioSpeedUpdates === 'true');

      } catch (e) {
        console.warn('⚠️ Failed to load settings:', e);
      }
    })();
  }, []);

  const onSpeedUnitChange = async (index) => {
    const value = index === 0 ? 'mph' : 'kph';
    setSpeedUnit(value);
    await AsyncStorage.setItem(STORAGE_KEYS.speedUnit, value);
  };

  return (
    <ScrollView style={[styles.background, { backgroundColor }]}>
      <View style={[styles.overlay, { backgroundColor }]}>
        <Text style={[styles.title, { color: titleColor }]}>Drive Settings</Text>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: textColor }]}>Speed Units</Text>
          <SegmentedControl
            values={['MPH', 'KPH']}
            selectedIndex={speedUnit === 'mph' ? 0 : 1}
            onChange={(event) => onSpeedUnitChange(event.nativeEvent.selectedSegmentIndex)}
            style={styles.segmentedControl}
          />
        </View>

        {[
          { label: 'Show Current Speed', state: showCurrentSpeed, setter: (v) => setShowCurrentSpeed(v), key: STORAGE_KEYS.showCurrentSpeed },
          { label: 'Show Speed Limit', state: showSpeedLimit, setter: (v) => setShowSpeedLimit(v), key: STORAGE_KEYS.showSpeedLimit },
          { label: 'Audio Speed Limit Updates', state: audioSpeedUpdatesEnabled, setter: (v) => setAudioSpeedUpdatesEnabled(v), key: STORAGE_KEYS.audioSpeedUpdatesEnabled },
          { label: 'Speeding Warnings', state: warningsEnabled, setter: (v) => setWarningsEnabled(v), key: STORAGE_KEYS.warningsEnabled },
          { label: 'Distracted Notifications', state: distractedNotificationsEnabled, setter: (v) => setDistractedNotificationsEnabled(v), key: STORAGE_KEYS.distractedNotificationsEnabled },
          { label: 'Show Total Points', state: displayTotalPoints, setter: (v) => setDisplayTotalPoints(v), key: STORAGE_KEYS.displayTotalPoints },
        ].map(({ label, state, setter, key }) => (
          <View key={label} style={styles.settingRowToggle}>
            <Text style={[styles.settingLabel, { color: textColor }]}>{label}</Text>
            <Switch
              value={state}
              onValueChange={async (value) => {
                setter(value);
                await AsyncStorage.setItem(key, value.toString());
              }}
              trackColor={{ false: '#767577', true: '#86ff7d' }}
              thumbColor={state ? '#ffffff' : '#f4f3f4'}
            />
          </View>
        ))}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    padding: width / (375 / 24),
  },
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
