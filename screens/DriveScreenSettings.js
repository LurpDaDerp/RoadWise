import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Dimensions, ImageBackground, TouchableOpacity, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

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

  const onWarningsToggle = async (index) => {
    const enabled = index === 0;
    setWarningsEnabled(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.warningsEnabled, enabled.toString());
  };

  const toggleShowCurrentSpeed = async (value) => {
    setShowCurrentSpeed(value);
    await AsyncStorage.setItem(STORAGE_KEYS.showCurrentSpeed, value.toString());
  };

  const toggleShowSpeedLimit = async (value) => {
    setShowSpeedLimit(value);
    await AsyncStorage.setItem(STORAGE_KEYS.showSpeedLimit, value.toString());
  };

  return (
    <ImageBackground source={require('../assets/settingsback.jpg')} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>

        <Text style={styles.title}>Drive Screen</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Speed Units</Text>
          <SegmentedControl
            values={['MPH', 'KPH']}
            selectedIndex={speedUnit === 'mph' ? 0 : 1}
            onChange={(event) => onSpeedUnitChange(event.nativeEvent.selectedSegmentIndex)}
            style={styles.segmentedControl}
          />
        </View>

        <View style={styles.settingRowToggle}>
          <Text style={styles.settingLabel}>Show Current Speed</Text>
          <Switch
            value={showCurrentSpeed}
            onValueChange={toggleShowCurrentSpeed}
            trackColor={{ false: '#767577', true: '#86ff7d' }}
            thumbColor={showCurrentSpeed ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingRowToggle}>
          <Text style={styles.settingLabel}>Show Speed Limit</Text>
          <Switch
            value={showSpeedLimit}
            onValueChange={toggleShowSpeedLimit}
            trackColor={{ false: '#767577', true: '#86ff7d' }}
            thumbColor={showCurrentSpeed ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingRowToggle}>
          <Text style={styles.settingLabel}>Audio Speed Limit Updates</Text>
          <Switch
            value={audioSpeedUpdatesEnabled}
            onValueChange={async (value) => {
              setAudioSpeedUpdatesEnabled(value);
              await AsyncStorage.setItem(STORAGE_KEYS.audioSpeedUpdatesEnabled, value.toString());
            }}
            trackColor={{ false: '#767577', true: '#86ff7d' }}
            thumbColor={audioSpeedUpdatesEnabled ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingRowToggle}>
            <Text style={styles.settingLabel}>Speeding Warnings</Text>
            <Switch
                value={warningsEnabled}
                onValueChange={async (value) => {
                setWarningsEnabled(value);
                await AsyncStorage.setItem(STORAGE_KEYS.warningsEnabled, value.toString());
                }}
                trackColor={{ false: '#767577', true: '#86ff7d' }}
                thumbColor={showCurrentSpeed ? '#ffffff' : '#f4f3f4'}
            />
        </View>

        <View style={styles.settingRowToggle}>
          <Text style={styles.settingLabel}>Distracted Notifications</Text>
          <Switch
            value={distractedNotificationsEnabled}
            onValueChange={async (value) => {
              setDistractedNotificationsEnabled(value);
              await AsyncStorage.setItem(STORAGE_KEYS.distractedNotificationsEnabled, value.toString());
            }}
            trackColor={{ false: '#767577', true: '#86ff7d' }}
            thumbColor={distractedNotificationsEnabled ? '#ffffff' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.settingRowToggle}>
          <Text style={styles.settingLabel}>Show Total Points</Text>
          <Switch
            value={displayTotalPoints}
            onValueChange={async (value) => {
              setDisplayTotalPoints(value);
              await AsyncStorage.setItem(STORAGE_KEYS.displayTotalPoints, value.toString());
            }}
            trackColor={{ false: '#767577', true: '#86ff7d' }}
            thumbColor={displayTotalPoints ? '#ffffff' : '#f4f3f4'}
          />
        </View>


      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    padding: width / (375 / 24),
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  menuButton: {
    position: 'absolute',
    top: height / (667 / 70),
    left: width / (375 / 20),
  },
  title: {
    fontSize: width / (375 / 32),
    fontWeight: 'bold',
    color: '#fff',
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
    color: '#fff',
  },
  segmentedControl: {
    height: 40,
  },
});
