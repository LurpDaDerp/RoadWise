// DriveScreen.js
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  AppState,
  Alert,
  Animated,
  ImageBackground,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../utils/firebase';

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

  const speedRef = useRef(0);
  const appState = useRef(AppState.currentState);
  const locationSubscription = useRef(null);
  const pointTimer = useRef(null);
  const isAppActive = useRef(true);
  const opacity = useRef(new Animated.Value(0)).current;
  const warningOpacity = useRef(new Animated.Value(0)).current;
  const backgroundTimeout = useRef(null);
  const startingPointsRef = useRef(0);

  const DEFAULT_SPEED_LIMIT_MPH = 25;
  const DEFAULT_SPEED_LIMIT_KPH = DEFAULT_SPEED_LIMIT_MPH * 1.60934;
  const DEFAULT_DELAY = 100;

  useEffect(() => {
    onAuthStateChanged(auth, () => {}); // still useful if you ever need user info
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const storedUnit = await AsyncStorage.getItem('@speedUnit');
          const storedWarnings = await AsyncStorage.getItem('@speedingWarningsEnabled');
          const storedShowCurrentSpeed = await AsyncStorage.getItem('@showCurrentSpeed');
          const storedShowSpeedLimit = await AsyncStorage.getItem('@showSpeedLimit');

          if (storedUnit === 'mph' || storedUnit === 'kph') setUnit(storedUnit);
          if (storedWarnings !== null) setShowSpeedingWarning(storedWarnings === 'true');
          if (storedShowCurrentSpeed !== null) setShowCurrentSpeed(storedShowCurrentSpeed === 'true');
          if (storedShowSpeedLimit !== null) setShowSpeedLimit(storedShowSpeedLimit === 'true');
        } catch (err) {
          console.warn('⚠️ Failed to load settings:', err);
        }
      })();
    }, [])
  );

  useEffect(() => {
    const startPts = route.params?.totalPoints ?? 0;
    startingPointsRef.current = startPts;
    setPointsThisDrive(0);
  }, []);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      const wasActive = appState.current === 'active';
      const nowInactive = nextAppState !== 'active';

      appState.current = nextAppState;
      isAppActive.current = !nowInactive;

      if (wasActive && nowInactive) {
        // We already continuously save points, so no need to save here.
        backgroundTimeout.current = setTimeout(() => {
          navigation.navigate('Dashboard', {
            updatedPoints: startingPointsRef.current + pointsThisDrive,
          });
        }, 2 * 60 * 1000);
      }

      if (!nowInactive && backgroundTimeout.current) {
        clearTimeout(backgroundTimeout.current);
        backgroundTimeout.current = null;
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
      if (backgroundTimeout.current) clearTimeout(backgroundTimeout.current);
    };
  }, [pointsThisDrive]);

  useEffect(() => {
    stopPointEarning();
    startPointEarning();
  }, [unit]);

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

  // CONTINUOUS ASYNC SAVE ON pointsThisDrive UPDATE
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

  const fetchSpeedLimit = async (lat, lon, unit) => {
    try {
      const url = `https://router.hereapi.com/v8/routes?transportMode=car&origin=${lat},${lon}&destination=${lat},${lon}&return=summary,polyline&apikey=${HERE_API_KEY}`;
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
    } catch {
      return null;
    }
  };

  const scheduleNextPoint = () => {
    const currentSpeed = speedRef.current;
    const effectiveSpeedLimit = Number(speedLimit ?? (unit === 'kph' ? DEFAULT_SPEED_LIMIT_KPH : DEFAULT_SPEED_LIMIT_MPH));
    const speedThreshold = unit === 'kph' ? 16.0934 : 10;

    let delay = currentSpeed <= effectiveSpeedLimit ? DEFAULT_DELAY : DEFAULT_DELAY + Math.min((currentSpeed - effectiveSpeedLimit) / effectiveSpeedLimit, 2) * 2000;
    if (currentSpeed > effectiveSpeedLimit * 1.5) delay = 100000;

    pointTimer.current = setTimeout(() => {
      setPointsThisDrive((prev) => prev + 1);
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

  const currentLimit = Number(speedLimit ?? (unit === 'kph' ? DEFAULT_SPEED_LIMIT_KPH : DEFAULT_SPEED_LIMIT_MPH));
  const isSpeeding = Math.round(speed) > currentLimit * 1.25;

  useEffect(() => {
    Animated.timing(warningOpacity, {
      toValue: showSpeedingWarning && isSpeeding ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [showSpeedingWarning, isSpeeding]);

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
            <Text style={styles.points} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.2}>
              {startingPointsRef.current + pointsThisDrive}
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

// styles remain unchanged, omitted here for brevity

const styles = StyleSheet.create({
  background: { flex: 1 },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0)',
  },
  speedLimitContainer: {
    position: 'absolute',
    top: 60,
    right: 10,
    width: 120,
    height: 120,
  },
  speedLimitSign: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  speedLimitText: {
    paddingTop: 50,
    fontSize: 46,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 25,
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
    marginTop: 100,
    fontSize: 120,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#fff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    textAlign: 'center',
  },
  pointsLabel: {
    fontSize: 24,
    color: '#fff',
    marginTop: 8,
  },
  speedBackground: {
    width: '100%',
    paddingVertical: 105,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -90,
    borderRadius: 20,
    overflow: 'hidden',
  },
  speedText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ff4444',
    textAlign: 'center',
    paddingHorizontal: 20,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
});
