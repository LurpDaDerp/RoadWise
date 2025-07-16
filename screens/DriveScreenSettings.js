import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ImageBackground, TouchableOpacity, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useNavigation, useTheme } from '@react-navigation/native';

const STORAGE_KEYS = {
  speedUnit: '@speedUnit',
  warningsEnabled: '@speedingWarningsEnabled',
  showCurrentSpeed: '@showCurrentSpeed',
  showSpeedLimit: '@showSpeedLimit',
};

export default function DriveScreenSettings() {
  const navigation = useNavigation();
  const [speedUnit, setSpeedUnit] = useState('mph');
  const [warningsEnabled, setWarningsEnabled] = useState(true);
  const [showCurrentSpeed, setShowCurrentSpeed] = useState(true);
  const [showSpeedLimit, setShowSpeedLimit] = useState(true);
  const { colors } = useTheme();

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

        

        {/* New toggles */}
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
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, padding: 24, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  menuButton: { position: 'absolute', top: 70, left: 20 },
  title: { fontSize: 36, fontWeight: 'bold', color: '#fff', marginTop: 75, marginBottom: 48, alignSelf: 'center' },
  settingRow: { marginBottom: 20 },
  settingRowToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingLabel: { fontSize: 18, marginBottom: 12, color: '#fff' },
  segmentedControl: { height: 40 },
});
