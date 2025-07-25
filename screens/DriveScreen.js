//DriveScreen
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  AppState,
  Alert,
  Animated,
  ImageBackground,
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, doc, updateDoc, increment } from 'firebase/firestore';

import { useDrive } from '../context/DriveContext';

const db = getFirestore();

const { width, height } = Dimensions.get('window');
const scale = (size) => (width / 375) * size;
const verticalScale = (size) => (height / 812) * size;

const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);
const HERE_API_KEY = 'G7cQbMXnjvzDsZwUEsc8yqVt001VXP3arshuxR4dHXQ';
const GRID_RESOLUTION = 0.001;

const speedLimitCache = new Map();
function getGridKey(lat, lon) {
  return `${Math.round(lat / GRID_RESOLUTION)}_${Math.round(lon / GRID_RESOLUTION)}`;
}

export default function DriveScreen({ route }) {
  const navigation = useNavigation();
  const [pointsThisDrive, setPointsThisDrive] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [unit, setUnit] = useState('mph');
  const [speedLimit, setSpeedLimit] = useState(null);
  const [showSpeedingWarning, setShowSpeedingWarning] = useState(true);
  const [showCurrentSpeed, setShowCurrentSpeed] = useState(true);
  const [showSpeedLimit, setShowSpeedLimit] = useState(true);
  const [displayTotalPoints, setDisplayTotalPoints] = useState(false);
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const [startingPoints, setStartingPoints] = useState(route.params?.totalPoints ?? 0);

  const speedRef = useRef(0);
  const appState = useRef(AppState.currentState);
  const locationSubscription = useRef(null);
  const pointTimer = useRef(null);
  const isAppActive = useRef(true);
  const isDistracted = useRef(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const warningOpacity = useRef(new Animated.Value(0)).current;
  const backgroundTimeout = useRef(null);
  const driveFinalizedRef = useRef(false);

  const DEFAULT_SPEED_LIMIT_MPH = 25;
  const DEFAULT_SPEED_LIMIT_KPH = DEFAULT_SPEED_LIMIT_MPH * 1.60934;
  const DEFAULT_DELAY = 100;
  const speedThreshold = unit === 'kph' ? 16.0934 : 10;

  const { setDriveJustCompleted } = useDrive();

  const finalizeDrive = async () => {
    if (driveFinalizedRef.current) return;
    driveFinalizedRef.current = true;

    const user = getAuth().currentUser;
    
    if (!user) return;
    
    try {
      const storedStreak = await AsyncStorage.getItem(`@drivingStreak_${user.uid}`);
      const currentStreak = storedStreak ? parseInt(storedStreak) : 0;
      if (isDistracted.current) {
        await AsyncStorage.setItem(`@drivingStreak_${user.uid}`, '0');
      } else if (pointsThisDrive >= 0) {
        const newStreak = currentStreak + 1;
        await AsyncStorage.setItem(`@drivingStreak_${user.uid}`, newStreak.toString());
      } 
      
    } catch (e) {
      console.warn('Failed to update drive streak:', e);
    }

    
    try {
      await AsyncStorage.setItem('@driveCompleteSnackbar', 'true');
    } catch (e) {
      console.warn('Failed to set snackbar flag:', e);
    }

    await AsyncStorage.setItem('@driveWasDistracted', isDistracted.current ? 'true' : 'false');

    setDriveJustCompleted(true);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async (e) => {
      e.preventDefault();

      await finalizeDrive();
      await AsyncStorage.setItem('@streakThisDrive', '1');

      navigation.dispatch(e.data.action);
    });

    return unsubscribe;
  }, [navigation, pointsThisDrive, startingPoints]);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const storedUnit = await AsyncStorage.getItem('@speedUnit');
          const storedWarnings = await AsyncStorage.getItem('@speedingWarningsEnabled');
          const storedShowCurrentSpeed = await AsyncStorage.getItem('@showCurrentSpeed');
          const storedShowSpeedLimit = await AsyncStorage.getItem('@showSpeedLimit');
          const storedDisplayMode = await AsyncStorage.getItem('@displayTotalPoints');

          if (storedUnit === 'mph' || storedUnit === 'kph') setUnit(storedUnit);
          if (storedWarnings !== null) setShowSpeedingWarning(storedWarnings === 'true');
          if (storedShowCurrentSpeed !== null) setShowCurrentSpeed(storedShowCurrentSpeed === 'true');
          if (storedShowSpeedLimit !== null) setShowSpeedLimit(storedShowSpeedLimit === 'true');
          if (storedDisplayMode !== null) setDisplayTotalPoints(storedDisplayMode === 'true');
        } catch (err) {
          console.warn('⚠️ Failed to load settings:', err);
        }
      })();
    }, [])
  );

  useEffect(() => {
    if (displayTotalPoints) {
      setDisplayedPoints(startingPoints + pointsThisDrive);
    } else {
      setDisplayedPoints(pointsThisDrive);
    }
  }, [pointsThisDrive, displayTotalPoints, startingPoints]);

  useEffect(() => {
    setStartingPoints(route.params?.totalPoints ?? 0);
    setPointsThisDrive(0);
    isDistracted.current = false;
  }, []);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    let unfocusedAt = null;

    const handleAppStateChange = (nextAppState) => {
      const wasActive = appState.current === 'active';
      const nowInactive = nextAppState !== 'active';

      appState.current = nextAppState;
      isAppActive.current = !nowInactive;

      if (wasActive && nowInactive) {
        unfocusedAt = Date.now();

        backgroundTimeout.current = setTimeout(async () => {
          await finalizeDrive();
          await AsyncStorage.setItem('@streakThisDrive', '1');
          navigation.goBack(); 
        }, 2 * 60 * 1000);
      }

      if (!nowInactive && unfocusedAt) {
        
        const unfocusedDuration = (Date.now() - unfocusedAt);
        if (unfocusedDuration > 5000/*  && speedRef.current > speedThreshold */) {
          isDistracted.current = true;
        }
        unfocusedAt = null;

        if (backgroundTimeout.current) {
          clearTimeout(backgroundTimeout.current);
          backgroundTimeout.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
      if (backgroundTimeout.current) clearTimeout(backgroundTimeout.current);
    };
  }, [pointsThisDrive, startingPoints, navigation]);


  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        async (loc) => {
          if (!isAppActive.current) return;

          const rawSpeed = loc.coords.speed ?? 0;
          const lat = loc.coords.latitude;
          const lon = loc.coords.longitude;
          const calcSpeed = unit === 'kph' ? rawSpeed * 3.6 : rawSpeed * 2.23694;

          const safeSpeed = Math.max(0, calcSpeed);
          setSpeed(safeSpeed);
          speedRef.current = safeSpeed;

          const gridKey = getGridKey(lat, lon);
          if (speedLimitCache.has(gridKey)) {
            setSpeedLimit(speedLimitCache.get(gridKey));
          } else {
            const sl = await fetchSpeedLimit(lat, lon, unit);
            if (sl !== null) {
              speedLimitCache.set(gridKey, sl);
              setSpeedLimit(sl);
            }
          }
        }
      );
    })();

    return () => {
      locationSubscription.current?.remove();
      stopPointEarning();
    };
  }, [unit]);

  useEffect(() => {
    const savePoints = async () => {
      try {
        await AsyncStorage.setItem('@pointsThisDrive', pointsThisDrive.toString());
      } catch (e) {
        console.warn('Failed to save points continuously:', e);
      }
    };
    savePoints();
  }, [pointsThisDrive]);

  const scheduleNextPoint = () => {
    const currentSpeed = speedRef.current;
    const effectiveSpeedLimit = Number(speedLimit ?? (unit === 'kph' ? DEFAULT_SPEED_LIMIT_KPH : DEFAULT_SPEED_LIMIT_MPH));

    let delay = currentSpeed <= effectiveSpeedLimit
      ? DEFAULT_DELAY
      : DEFAULT_DELAY + Math.min((currentSpeed - effectiveSpeedLimit) / effectiveSpeedLimit, 2) * 2000;

    if (currentSpeed > effectiveSpeedLimit * 1.5) delay = 100000;

    pointTimer.current = setTimeout(() => {
      if (currentSpeed > speedThreshold) {
        setPointsThisDrive((prev) => prev + 1);
      }
      scheduleNextPoint();
    }, delay);
  };

  const startPointEarning = () => {
    if (!pointTimer.current) scheduleNextPoint();
  };

  const stopPointEarning = () => {
    if (pointTimer.current) {
      clearTimeout(pointTimer.current);
      pointTimer.current = null;
    }
  };

  const fetchSpeedLimit = async (lat, lon, unit) => {
    try {
      const delta = 0.0005;
      const destLat = lat + delta;
      const destLon = lon + delta;

      const url = `https://router.hereapi.com/v8/routes?transportMode=car&origin=${lat},${lon}&destination=${destLat},${destLon}&return=summary,spans&apikey=${HERE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      const spans = data?.routes?.[0]?.sections?.[0]?.spans;
      if (!spans?.length) return null;

      for (const span of spans) {
        if (span.speedLimit?.speed) {
          const limitKph = span.speedLimit.speed;
          return unit === 'kph' ? limitKph : limitKph * 0.621371;
        }
      }

      return null;
    } catch (error) {
      console.warn('Failed to fetch speed limit:', error);
      return null;
    }
  };

  const currentLimit = Number(speedLimit ?? (unit === 'kph' ? DEFAULT_SPEED_LIMIT_KPH : DEFAULT_SPEED_LIMIT_MPH));
  const isSpeeding = Math.round(speed) > currentLimit * 1.25;

  const getFontSizeForPoints = (points) => {
    const digits = points.toString().length;
    const maxFontSize = 120;
    const minFontSize = 60;

    const scaleFactor = Math.min(digits, 8) / 8;
    return maxFontSize - scaleFactor * (maxFontSize - minFontSize);
  };

  useEffect(() => {
    Animated.timing(warningOpacity, {
      toValue: showSpeedingWarning && isSpeeding ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [showSpeedingWarning, isSpeeding]);

  useEffect(() => {
    stopPointEarning();
    startPointEarning();
  }, [unit]);

  return (
    <AnimatedImageBackground
      source={require('../assets/driveback.jpg')}
      style={[styles.background, { opacity }]}
      resizeMode="cover"
      onLoad={() =>
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }).start()
      }
    >
      <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.darkOverlay} />

      {showSpeedLimit && (
        <View style={styles.speedLimitContainer}>
          <ImageBackground
            source={require('../assets/speedlimit.png')}
            style={styles.speedLimitSign}
            resizeMode="contain"
          >
            <Text style={styles.speedLimitText}>{Math.round(currentLimit)}</Text>
          </ImageBackground>
        </View>
      )}

      <View style={styles.container}>
        <View style={styles.pointsContainer}>
          <View style={styles.pointsWrapper}>
            <Text style={[styles.points, { fontSize: getFontSizeForPoints(displayedPoints) }]}>
              {displayedPoints}
            </Text>
          </View>
          <Text style={styles.pointsLabel}>Points</Text>
        </View>

        {showCurrentSpeed && (
          <ImageBackground
            source={require('../assets/dashboard.png')}
            style={styles.speedBackground}
            resizeMode="cover"
            imageStyle={{ borderRadius: 20 }}
          >
            <Text style={styles.speedText}>
              {Math.round(speed)} {unit.toUpperCase()}
            </Text>
          </ImageBackground>
        )}
      </View>

      <Animated.View style={[styles.warningOverlay, { opacity: warningOpacity }]}>
        <Text style={styles.warningOverlayText}>⚠️ You are speeding!</Text>
      </Animated.View>
    </AnimatedImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0)',
  },
  speedLimitContainer: {
    position: 'absolute',
    top: verticalScale(60),
    right: scale(10),
    width: scale(100),
    height: scale(100),
  },
  speedLimitSign: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedLimitText: {
    paddingTop: verticalScale(50),
    fontSize: scale(36),
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(25),
  },
  pointsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointsWrapper: {
    maxWidth: '90%',
    width: '90%',
    alignItems: 'center',
  },
  points: {
    marginTop: verticalScale(100),
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#fff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: scale(12),
    textAlign: 'center',
  },
  pointsLabel: {
    fontSize: scale(24),
    color: '#fff',
    marginTop: verticalScale(8),
  },
  speedBackground: {
    width: '100%',
    paddingVertical: verticalScale(120),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(-100),
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  speedText: {
    fontSize: scale(48),
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: scale(4),
  },
  warningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  warningOverlayText: {
    fontSize: scale(32),
    fontWeight: 'bold',
    color: '#ff4444',
    textAlign: 'center',
    paddingHorizontal: scale(20),
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: scale(6),
  },
});
