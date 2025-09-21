//DriveScreen
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  AppState,
  Alert,
  Animated,
  ImageBackground,
  Dimensions,
  TouchableOpacity,
  Linking,
  Image, 
  ActivityIndicator
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../utils/firebase';
import { getFirestore, doc, updateDoc, increment, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { saveTrustedContacts, getTrustedContacts, saveDriveMetrics, getHereKey, startDriving, stopDriving } from '../utils/firestore';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { scheduleDistractedNotification, scheduleFirstDistractedNotification, requestNotificationPermissions, scheduleBackgroundNotification } from '../utils/notifications';
import { format } from 'date-fns';
import { useDrive } from '../context/DriveContext';
import * as Speech from 'expo-speech';
import { LinearGradient } from "expo-linear-gradient";
import { fetchWeather, getWeatherIconName } from '../utils/weather';
import { MaterialCommunityIcons } from "@expo/vector-icons";


const db = getFirestore();

const { width, height } = Dimensions.get('window');

const fireImages = {
  gray: require('../assets/streaks/gray.png'),
  orange: require('../assets/streaks/orange.png'),
  green: require('../assets/streaks/green.png'),
  purple: require('../assets/streaks/purple.png'),
  pink: require('../assets/streaks/pink.png'),
  blue: require('../assets/streaks/blue.png'),
};

function getFireImage(streak) {
  if (streak === 0) return fireImages.gray;
  else if (streak <= 10) return fireImages.orange;
  else if (streak <= 25) return fireImages.green;
  else if (streak <= 50) return fireImages.purple;
  else if (streak <= 100) return fireImages.pink;
  else return fireImages.blue;
}

const weatherCodeMap = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  80: "Light rain showers",
  81: "Moderate rain showers",
  82: "Heavy rain showers",
  95: "Thunderstorm (slight/moderate)",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function celsiusToFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);
const GRID_RESOLUTION = 0.002;
const speedLimitCache = new Map();
let lastSpeedLimitFetchTime = 0;
let lastSpeedLimitFetchCoords = null;

const audioSource = require('../assets/sounds/alert.mp3');

function getGridKey(lat, lon) {
  return `${Math.round(lat / GRID_RESOLUTION)}_${Math.round(lon / GRID_RESOLUTION)}`;
}

async function loadSpeedLimitCache() {
  try {
    const cached = await AsyncStorage.getItem('@speedLimitCache');
    if (cached) {
      const entries = JSON.parse(cached);
      for (const [key, val] of entries) {
        if (typeof val === 'number') {
          speedLimitCache.set(key, { value: val, unit: 'mph' });
        } else if (val && typeof val === 'object' && 'value' in val && 'unit' in val) {
          speedLimitCache.set(key, val);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Failed to load speed limit cache:', err);
  }
}
async function saveSpeedLimitCache() {
  try {
    await AsyncStorage.setItem('@speedLimitCache', JSON.stringify(Array.from(speedLimitCache.entries())));
  } catch (err) {
    console.warn('⚠️ Failed to save speed limit cache:', err);
  }
}

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

function interpolateColor(speed, limit) {
  if (!isFinite(limit) || limit <= 0) return "rgb(0,230,0)";

  const percent = Math.max(0, Math.min(1, (speed - limit) / (limit * 0.4)));

  const green  = { r: 0,   g: 200, b: 0 };
  const yellow = { r: 255, g: 255, b: 0 };
  const red    = { r: 255, g: 0,   b: 0 };

  let r, g, b;
  if (percent <= 0.5) {
    const t = percent / 0.5;
    r = Math.round(green.r  + (yellow.r - green.r) * t);
    g = Math.round(green.g  + (yellow.g - green.g) * t);
    b = Math.round(green.b  + (yellow.b - green.b) * t);
  } else {
    const t = (percent - 0.5) / 0.5;
    r = Math.round(yellow.r + (red.r - yellow.r) * t);
    g = Math.round(yellow.g + (red.g - yellow.g) * t);
    b = Math.round(yellow.b + (red.b - yellow.b) * t);
  }

  return `rgb(${r},${g},${b})`;
}



export default function DriveScreen({ route }) {
  const player = useAudioPlayer(audioSource);
  const navigation = useNavigation();
  const [pointsThisDrive, setPointsThisDrive] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [unit, setUnit] = useState('mph');
  const [speedLimit, setSpeedLimit] = useState(null);
  const [showSpeedingWarning, setShowSpeedingWarning] = useState(true);
  const [shouldShowWarning, setShouldShowWarning] = useState(false);
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showCurrentSpeed, setShowCurrentSpeed] = useState(true);
  const [showSpeedLimit, setShowSpeedLimit] = useState(true);
  const speedLimitRef = useRef(speedLimit);
  const prevLimitRef = useRef(null);
  const [displayTotalPoints, setDisplayTotalPoints] = useState(false);
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const [startingPoints, setStartingPoints] = useState(route.params?.totalPoints ?? 0);
  const [distractedNotificationsEnabled, setDistractedNotificationsEnabled] = useState(true);
  const [distractedCount, setDistractedCount] = useState(0);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [trustedContacts, setTrustedContacts] = useState([]);
  const [HERE_API_KEY, setHereKey] = useState();
  const hasStartedDriving = useRef(false);
  const [audioSpeedUpdatesEnabled, setAudioSpeedUpdatesEnabled] = useState(true);

  const [isEmergencyActive, setIsEmergencyActive] = useState(false);

  const user = auth.currentUser;

  const speedRef = useRef(0);
  const speedingTimeoutRef = useRef(null);
  const appState = useRef(AppState.currentState);
  const locationSubscription = useRef(null);
  const pointTimer = useRef(null);
  const isAppActive = useRef(true);
  const isDistracted = useRef(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const warningOpacity = useRef(new Animated.Value(0)).current;
  const backgroundTimeout = useRef(null);
  const driveFinalizedRef = useRef(false);

  const lastLocation = useRef(null);
  const totalDistance = useRef(0); 

  const [weather, setWeather] = useState(null);
  const lastWeatherFetchTime = useRef(0);
  const lastWeatherCoords = useRef(null);

  const DEFAULT_SPEED_LIMIT_MPH = 25;
  const DEFAULT_SPEED_LIMIT_KPH = DEFAULT_SPEED_LIMIT_MPH * 1.60934;
  const DEFAULT_DELAY = 2500;
  const speedThreshold = unit === 'kph' ? 16.0934 : 10;

  const { setDriveJustCompleted } = useDrive();

  const { resolvedTheme } = useContext(ThemeContext);

  const isDarkMode = resolvedTheme === 'dark';

  const modalBackgroundColor = isDarkMode ? '#222' : '#fff'; 
  const titleTextColor = isDarkMode ? '#fff' : '#000'; 
  const contentTextColor = isDarkMode ? '#eee' : '#000';     
  const buttonBackgroundColor = isDarkMode ? '#444' : '#000'; 
  const buttonTextColor = isDarkMode ? '#fff' : '#fff';   

  const backgroundColor = isDarkMode ? '#131313ff' : '#fff';
  const titleColor = isDarkMode ? '#fff' : '#000';
  const textColor = isDarkMode ? '#fff' : '#000';
  const moduleBackground = isDarkMode ? '#272727ff' : '#ffffffff';
  const altTextColor = isDarkMode ? '#aaa' : '#555';
  const textOutline = isDarkMode? 'rgba(255, 255, 255, 0.47)' : '#0000008e';
  const buttonColor = isDarkMode ? `rgba(92, 55, 255, 1)` : `rgba(99, 71, 255, 1)`;
  const gradientTop = isDarkMode ? "#000000ff" : "#f1f1f1ff"; 
  const gradientBottom = isDarkMode ? "#292929ff" : "#ffffffff"; 

  const [streak, setStreak] = useState(0);

  const soundRef = useRef(null);

  const driveStartTime = useRef(Date.now());

  const totalSpeedSum = useRef(0);
  const speedSampleCount = useRef(0);

  const speedingMarginSum = useRef(0);
  const speedingSampleCount = useRef(0);

  const suddenStops = useRef(0);
  const suddenAccelerations = useRef(0);

  const phoneUsageTime = useRef(0);
  const phoneUsageStart = useRef(null);

  const lastSpeedValue = useRef(0);
  const ACCEL_THRESHOLD = 3.0; 
  const BRAKE_THRESHOLD = -3.0; 
  let lastUpdateTime = Date.now();

  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: { display: 'none' },
    });

    return () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: {
          display: 'flex',
        },
      });
    };
  }, [navigation]);

  //finalize drive function
  const finalizeDrive = async () => {
    
    if (driveFinalizedRef.current) return;
    driveFinalizedRef.current = true;

    stopDriving(user.uid);
    
    if (!user) return;

    const driveDurationMs = Date.now() - driveStartTime.current;
    const droveLongEnough = driveDurationMs >= 60 * 1000;

    const wasDistracted = isDistracted.current;
    const timestamp = new Date().toISOString();

    const driveMetrics = {
      timestamp, 
      points: pointsThisDrive,
      duration: Math.round(driveDurationMs / 1000),
      distracted: distractedCount,
      avgSpeed: speedSampleCount.current
        ? totalSpeedSum.current / speedSampleCount.current
        : 0,
      avgSpeedingMargin: speedingSampleCount.current
        ? speedingMarginSum.current / speedingSampleCount.current
        : 0,
      suddenStops: suddenStops.current,
      suddenAccelerations: suddenAccelerations.current,
      phoneUsageTime: phoneUsageTime.current,
      totalDistance: totalDistance.current ?? 0,
    };

    if (pointsThisDrive > 0 /* && droveLongEnough */) {
      try {
        await saveDriveMetrics(user.uid, driveMetrics);
      } catch (e) {
        console.warn('Failed to save drive history:', e);
      }
    }
      

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      const currentStreak = userDocSnap.exists() && userDocSnap.data().drivingStreak
        ? userDocSnap.data().drivingStreak
        : 0;
      if (pointsThisDrive > 0 /* && droveLongEnough */) {
        let newStreak;
        if (wasDistracted) {
          newStreak = 0; 
        } else {
          newStreak = currentStreak + 1;
        }

        await setDoc(userDocRef, { drivingStreak: newStreak }, { merge: true });
        setStreak(newStreak);
        await AsyncStorage.setItem('@streakThisDrive', '1');
      }
    } catch (e) {
      console.warn('Failed to update drive streak:', e);
    }
    
    if (pointsThisDrive > 0) {
      await AsyncStorage.setItem('@driveCompleteSnackbar', 'true');
    }
    
    await AsyncStorage.setItem('@pointsThisDrive', pointsThisDrive.toString());
    await AsyncStorage.setItem('@driveWasDistracted', isDistracted.current ? 'true' : 'false');
    
    setDriveJustCompleted(true);
  };
       
  useFocusEffect(
    React.useCallback(() => {
      const fetchStreak = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
          const userDocRef = doc(db, "users", uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists() && userSnap.data().drivingStreak) {
            setStreak(userSnap.data().drivingStreak);
          }
        } catch (err) {
          console.warn("⚠️ Failed to fetch streak:", err);
        }
      };

      fetchStreak();
    }, [])
  );

  useEffect(() => {
    if (!hasStartedDriving.current && speedRef.current >= speedThreshold) {
      hasStartedDriving.current = true;
      startDriving(user.uid);
    }
  }, [speedRef.current, user.uid]);

  //make calls within app 
  const callNumber = (phone) => {
    if (!phone) {
      Alert.alert('Error', 'No phone number provided.');
      return;
    }

    const phoneNumber = `tel:${phone}`;
    Linking.canOpenURL(phoneNumber)
      .then((supported) => {
        if (!supported) {
          Alert.alert('Error', 'Phone call is not supported on this device.');
        } else {
          return Linking.openURL(phoneNumber);
        }
      })
      .catch((err) => console.error('Failed to call number:', err));
  };

  //load contacts
  useFocusEffect(
    React.useCallback(() => {
      const uid = auth.currentUser?.uid;

      const loadContacts = async () => {
        const contacts = await getTrustedContacts(uid);
        setTrustedContacts(contacts);
      };

      const loadAPIKey = async () => {
        const key = await getHereKey("HERE_API_KEY");
        setHereKey(key);
      };
      
      loadAPIKey();
      loadContacts();
      
    }, [])
  );

  //request notification permissions
  useEffect(() => {
    const requestPermissions = async () => {
      if (Device.isDevice) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Notification permissions not granted');
        }
      }
    };
    requestPermissions();
  }, []);

  //load relevant settings on focus
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const storedUnit = await AsyncStorage.getItem('@speedUnit');
          const storedWarnings = await AsyncStorage.getItem('@speedingWarningsEnabled');
          const storedShowCurrentSpeed = await AsyncStorage.getItem('@showCurrentSpeed');
          const storedShowSpeedLimit = await AsyncStorage.getItem('@showSpeedLimit');
          const storedDisplayMode = await AsyncStorage.getItem('@displayTotalPoints');
          const storedDistracted = await AsyncStorage.getItem('@distractedNotificationsEnabled');
          const storedAudioSpeedUpdates = await AsyncStorage.getItem('@audioSpeedUpdatesEnabled');

          if (storedUnit === 'mph' || storedUnit === 'kph') setUnit(storedUnit);
          if (storedWarnings !== null) setShowSpeedingWarning(storedWarnings === 'true');
          if (storedShowCurrentSpeed !== null) setShowCurrentSpeed(storedShowCurrentSpeed === 'true');
          if (storedShowSpeedLimit !== null) setShowSpeedLimit(storedShowSpeedLimit === 'true');
          if (storedDisplayMode !== null) setDisplayTotalPoints(storedDisplayMode === 'true');
          if (storedDistracted !== null) setDistractedNotificationsEnabled(storedDistracted === 'true');
          if (storedAudioSpeedUpdates !== null) setAudioSpeedUpdatesEnabled(storedAudioSpeedUpdates === 'true');
        } catch (err) {
          console.warn('⚠️ Failed to load settings:', err);
        }
      })();
    }, [])
  );

  //update displayed points based on settings
  useEffect(() => {
    if (displayTotalPoints) {
      setDisplayedPoints(startingPoints + pointsThisDrive);
    } else {
      setDisplayedPoints(pointsThisDrive);
    }
  }, [pointsThisDrive, displayTotalPoints, startingPoints]);

  //reset points and isDistracted on mount
  useEffect(() => {
    setStartingPoints(route.params?.totalPoints ?? 0);
    setPointsThisDrive(0);
    isDistracted.current = false;
    driveStartTime.current = Date.now();
  }, []);
  
  //update speed 
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  //handle app state changes for backgrounding
  const firstNotificationId = useRef(null);
  const unfocusedAt = useRef(null);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      const wasActive = appState.current === 'active';
      const nowInactive = nextAppState !== 'active';

      appState.current = nextAppState;
      isAppActive.current = !nowInactive;

      if (wasActive && nowInactive) {
        unfocusedAt.current = Date.now();
        setDistractedCount(prev => prev + 1);
        backgroundTimeout.current = setTimeout(async () => {
          
          if (pointsThisDrive > 0) {
            isDistracted.current = true;
            
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Drive ended',
                body: 'Drive has ended after 2 minutes of inactivity. Your streak has been reset.',
              },
              trigger: null,
            });

          }
          
          await finalizeDrive();
          if (isEmergencyActive) {
            cancelGroupEmergency();
          }
          navigation.goBack();
        }, 2 * 60 * 1000);

        if (distractedNotificationsEnabled && pointsThisDrive > 0) {
          firstNotificationId.current = await scheduleFirstDistractedNotification();
        }
      }

      if (!nowInactive && unfocusedAt.current) {
        const unfocusedDuration = Date.now() - unfocusedAt.current;

        if (backgroundTimeout.current) {
          clearTimeout(backgroundTimeout.current);
          backgroundTimeout.current = null;
        }

        if (pointsThisDrive > 0) {
          
          
          if (unfocusedDuration > 5000) {
            isDistracted.current = true;

            if (firstNotificationId.current) {
              await Notifications.cancelScheduledNotificationAsync(firstNotificationId.current);
              firstNotificationId.current = null;
            }

            if (distractedNotificationsEnabled) {
              await scheduleDistractedNotification();
            }
          } else {
            if (firstNotificationId.current) {
              await Notifications.cancelScheduledNotificationAsync(firstNotificationId.current);
              firstNotificationId.current = null;
            }
          }
        }

        unfocusedAt.current = null;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (backgroundTimeout.current) {
        clearTimeout(backgroundTimeout.current);
        backgroundTimeout.current = null;
      }
    };
  }, [pointsThisDrive, distractedNotificationsEnabled, navigation]);

  useEffect(() => {
    speedLimitRef.current = speedLimit;
  }, [speedLimit]);

  //location and speed tracking + speed limit logic
  useEffect(() => {

    if (!HERE_API_KEY) return;

    (async () => {
      await loadSpeedLimitCache();

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 10,
        },
        async (loc) => {
          if (!isAppActive.current) return;

          const coordinates = [loc.coords.latitude, loc.coords.longitude];
          const testcoordinates = [47.56560520753297, -122.2253784109515];
          const rawSpeed = loc.coords.speed ?? 0;
          const lat = testcoordinates[0];
          const lon = testcoordinates[1];

          if (lastLocation.current) {
            const dist = getDistanceFromLatLonInMeters(
              lastLocation.current.latitude,
              lastLocation.current.longitude,
              lat,
              lon
            );
            totalDistance.current += dist;
          }
          lastLocation.current = { latitude: lat, longitude: lon };

          const gridKey = getGridKey(lat, lon);
          if (speedLimitCache.has(gridKey)) {
            const cached = speedLimitCache.get(gridKey);
            let adjustedValue = cached.value;

            if (cached.unit !== unit) {
              if (cached.unit === 'mph' && unit === 'kph') {
                adjustedValue = cached.value * 1.60934;
              } else if (cached.unit === 'kph' && unit === 'mph') {
                adjustedValue = cached.value * 0.621371;
              }
            }

            setSpeedLimit(adjustedValue);
          } else {
            const now = Date.now();
            const distSinceLastFetch = lastSpeedLimitFetchCoords
              ? getDistanceFromLatLonInMeters(
                  lastSpeedLimitFetchCoords.latitude,
                  lastSpeedLimitFetchCoords.longitude,
                  lat,
                  lon
                )
              : Infinity; 

            if (showSpeedLimit && now - lastSpeedLimitFetchTime > 15000 && distSinceLastFetch >= 250) {
              lastSpeedLimitFetchTime = now;
              lastSpeedLimitFetchCoords = { latitude: lat, longitude: lon };

              const sl = await fetchSpeedLimit(lat, lon, unit);
              if (sl !== null) {
                speedLimitCache.set(gridKey, { value: sl, unit: unit });
                setSpeedLimit(sl);
                await saveSpeedLimitCache();
              }
            }
          }

          const calcSpeed = unit === 'kph' ? rawSpeed * 3.6 : rawSpeed * 2.23694;

          const safeSpeed = Math.max(0, calcSpeed);
          setSpeed(safeSpeed);
          speedRef.current = safeSpeed;

          totalSpeedSum.current += safeSpeed;
          speedSampleCount.current++;

          const limit = Number(speedLimitRef.current ?? (unit === 'kph' ? DEFAULT_SPEED_LIMIT_KPH : DEFAULT_SPEED_LIMIT_MPH));
          if (safeSpeed > limit) {
            speedingMarginSum.current += safeSpeed - limit;
            speedingSampleCount.current++;
          }

          

          const now = Date.now();
          const timeDiff = (now - lastUpdateTime) / 1000; 
          const acceleration = ((rawSpeed) - (lastSpeedValue.current / (unit === 'kph' ? 3.6 : 2.23694))) / timeDiff;

          if (acceleration > ACCEL_THRESHOLD) suddenAccelerations.current++;
          if (acceleration < BRAKE_THRESHOLD) suddenStops.current++;

          lastSpeedValue.current = safeSpeed;
          lastUpdateTime = now;

          const nowWeather = Date.now();
          const elapsed = (nowWeather - lastWeatherFetchTime.current) / 1000; 
          const distSinceLastWeather = lastWeatherCoords.current
            ? getDistanceFromLatLonInMeters(
                lastWeatherCoords.current.latitude,
                lastWeatherCoords.current.longitude,
                lat,
                lon
              )
            : Infinity;

          if (elapsed >= 10 && distSinceLastWeather >= 100) {
            try {
              const data = await fetchWeather(lat, lon);
              if (data) {
                setWeather(data);
                lastWeatherFetchTime.current = nowWeather;
                lastWeatherCoords.current = { latitude: lat, longitude: lon };
              }
            } catch (err) {
              console.error("Weather fetch error:", err);
            }
          }

          
        }
      );
    })();

    return () => {
      locationSubscription.current?.remove();
      stopPointEarning();
    };
  }, [unit, HERE_API_KEY]);
  
  //audio update if changing speed limits
  useEffect(() => {
    if (!audioSpeedUpdatesEnabled) return;

    if (speedLimit != null && speedLimit !== prevLimitRef.current) {
      Speech.stop();
      Speech.speak(`Speed limit is now ${speedLimit}`, {
        language: "en",
        pitch: 0.8,
        rate: 0.8,
      });
      prevLimitRef.current = speedLimit;
    }
  }, [speedLimit, audioSpeedUpdatesEnabled]);

  //increment points based on speed
  const scheduleNextPoint = () => {
    const currentSpeed = speedRef.current;
    const effectiveSpeedLimit = Number(speedLimitRef.current ?? (unit === 'kph' ? DEFAULT_SPEED_LIMIT_KPH : DEFAULT_SPEED_LIMIT_MPH));    

    if (currentSpeed > effectiveSpeedLimit * 1.5) {
      pointTimer.current = setTimeout(scheduleNextPoint, delay);
      return;
    }

    let delay = currentSpeed <= effectiveSpeedLimit
      ? DEFAULT_DELAY
      : DEFAULT_DELAY + Math.min((currentSpeed - effectiveSpeedLimit) / effectiveSpeedLimit, 2) * 2000;

    pointTimer.current = setTimeout(() => {
      const latestSpeed = speedRef.current; 
      const latestEffectiveLimit = Number(speedLimitRef.current ?? (unit === 'kph' ? DEFAULT_SPEED_LIMIT_KPH : DEFAULT_SPEED_LIMIT_MPH));

      if (latestSpeed > latestEffectiveLimit * 1.5) {
        scheduleNextPoint();
        return;
      }

      if (latestSpeed > speedThreshold) {
        setPointsThisDrive((prev) => prev + 1);
      }

      scheduleNextPoint(); 
    }, delay);
  };


  //start and stop point earning based on app state
  const startPointEarning = () => {
    if (!pointTimer.current) scheduleNextPoint();
  };

  const stopPointEarning = () => {
    if (pointTimer.current) {
      clearTimeout(pointTimer.current);
      pointTimer.current = null;
    }
  };

  //fetch speed limit from HERE API
  const fetchSpeedLimit = async (lat, lon, unit) => {
    try {
      const url = `https://revgeocode.search.hereapi.com/v1/revgeocode?at=${lat},${lon}&lang=en-US&showNavAttributes=speedLimits&apikey=${HERE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      const item = data?.items?.[0];
      const street = item?.address?.street || item?.address?.label || '[Unknown Street]';

      const speedObj = item?.navigationAttributes?.speedLimits?.[0];

      if (!speedObj?.maxSpeed || !speedObj?.speedUnit) {
        console.warn(`No speed limit info returned. Street: ${street}`);
        return null;
      }
      const rawSpeed = speedObj.maxSpeed;
      const sourceUnit = speedObj.speedUnit.toLowerCase();

      let convertedSpeed;
      if (sourceUnit === 'mph') {
        convertedSpeed = unit === 'kph' ? rawSpeed * 1.60934 : rawSpeed;
      } else if (sourceUnit === 'km/h' || sourceUnit === 'kph') {
        convertedSpeed = unit === 'mph' ? rawSpeed * 0.621371 : rawSpeed;
      } else {
        console.warn(`Unknown speed unit: ${sourceUnit}`);
        return null;
      }

      return convertedSpeed;
    } catch (err) {
      console.error('Failed to fetch speed limit via reverse geocode:', err);
      return null;
    }
  };

  //calculate current speed limit and speeding status
  const currentLimit = Number(speedLimit ?? (unit === 'kph' ? DEFAULT_SPEED_LIMIT_KPH : DEFAULT_SPEED_LIMIT_MPH));
  const isSpeeding = Math.round(speed) > currentLimit * 1.25;
  const soundLoopIntervalRef = useRef(null);

  useEffect(() => {
    (async () => {
      await setAudioModeAsync({
        playsInSilentMode: true, 
      });
    })();
  }, []);

  useEffect(() => {
    if (showSpeedingWarning && isSpeeding) {
      if (!speedingTimeoutRef.current) {
        speedingTimeoutRef.current = setTimeout(() => {
          setShouldShowWarning(true);

          player.seekTo(0);
          player.play();

          soundLoopIntervalRef.current = setInterval(() => {
            player.seekTo(0);
            player.play();
          }, 700); 
        }, 2500);
      }
    } else {
      clearTimeout(speedingTimeoutRef.current);
      speedingTimeoutRef.current = null;

      clearInterval(soundLoopIntervalRef.current);
      soundLoopIntervalRef.current = null;

      setShouldShowWarning(false);
    }
  }, [isSpeeding, showSpeedingWarning]);

  useEffect(() => {
    return () => {
      clearTimeout(speedingTimeoutRef.current);
      clearInterval(soundLoopIntervalRef.current);
    };
  }, []);

  //show speeding warning if enabled and speeding
  useEffect(() => {
    if (shouldShowWarning) {
      setShowSpeedModal(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setShowSpeedModal(false);
      });
    }
  }, [shouldShowWarning]);



  //start point earning when unit changes
  useEffect(() => {
    stopPointEarning();
    startPointEarning();
  }, [unit]);

  //scale points font size to fit in screen comfortably
  const getFontSizeForPoints = (points) => {
    const digits = points.toString().length;
    const maxFontSize = 120;
    const minFontSize = 60;

    const scaleFactor = Math.min(digits, 8) / 8;
    return maxFontSize - scaleFactor * (maxFontSize - minFontSize);
  };

  const notifyGroupEmergency = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const userDocRef = doc(db, "users", uid);
      const userSnap = await getDoc(userDocRef);
      const groupId = userSnap.exists() ? userSnap.data().groupId : null;

      if (groupId) {
        const groupRef = doc(db, "groups", groupId);
        const groupSnap = await getDoc(groupRef);

        let userLoc = {};
        if (groupSnap.exists()) {
          const data = groupSnap.data();
          userLoc = data.memberLocations?.[uid] || {};
        }

        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude, speed } = loc.coords;

        if (!userLoc.emergency) {
          await updateDoc(groupRef, {
            [`memberLocations.${uid}.latitude`]: latitude ?? null,
            [`memberLocations.${uid}.longitude`]: longitude ?? null,
            [`memberLocations.${uid}.speed`]: speed ?? 0,
            [`memberLocations.${uid}.updatedAt`]: new Date(),
            [`memberLocations.${uid}.emergency`]: true,
          });
        }

        setIsEmergencyActive(true);

        Alert.alert("Group Notified", "Emergency alert has been sent to your group.");
      } else {
        Alert.alert("⚠️ Not in a group", "You must join a group to notify them.");
      }
    } catch (err) {
      console.error("Error notifying group:", err);
      Alert.alert("Error", "Failed to notify your group. Please try again.");
    }
  };

  const cancelGroupEmergency = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const userDocRef = doc(db, "users", uid);
      const userSnap = await getDoc(userDocRef);
      const groupId = userSnap.exists() ? userSnap.data().groupId : null;

      if (groupId) {
        const groupRef = doc(db, "groups", groupId);

        await updateDoc(groupRef, {
          [`memberLocations.${uid}.emergency`]: false,
        });

        setIsEmergencyActive(false);

        Alert.alert("Emergency Cancelled", "Your group has been notified that you are safe.");
      } else {
        Alert.alert("⚠️ Not in a group", "You must join a group to cancel emergency.");
      }
    } catch (err) {
      console.error("Error cancelling emergency:", err);
      Alert.alert("Error", "Failed to cancel emergency. Please try again.");
    }
  };

  const pulseOverlayAnim = useRef(new Animated.Value(0)).current;
  const pulseLoop = useRef(null);

  useEffect(() => {
  if (isSpeeding) {
      if (!pulseLoop.current) {
        pulseLoop.current = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseOverlayAnim, {
              toValue: 0.5,
              duration: 500,
              useNativeDriver: false,
            }),
            Animated.timing(pulseOverlayAnim, {
              toValue: 0,
              duration: 500,
              useNativeDriver: false,
            }),
          ])
        );
        pulseLoop.current.start();
      }
    } else {
      if (pulseLoop.current) {
        pulseLoop.current.stop();
        pulseLoop.current = null;
      }
      pulseOverlayAnim.setValue(0);
    }
  }, [isSpeeding]);

  //UI element rendering
  return (
    <>
      {showSpeedModal && (
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]} pointerEvents="box-none">
          <View style={[styles.modalContent, { backgroundColor: modalBackgroundColor }]} pointerEvents="auto">
            <Text style={[styles.modalTitle, { color: titleTextColor }]}>⚠️ You are Speeding!</Text>
            <Text style={[styles.modalText, { color: contentTextColor }]}>
              Please slow down.
            </Text>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: buttonBackgroundColor }]}
              onPress={() => {
                Animated.timing(fadeAnim, {
                  toValue: 0,
                  duration: 400,
                  useNativeDriver: true,
                }).start(() => {
                  setShowSpeedModal(false);
                });
              }}
            >
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {showEmergencyModal && (
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <View style={[styles.modalContent, { backgroundColor: modalBackgroundColor }]} pointerEvents="auto">
            <Text style={[styles.modalTitle, { color: titleTextColor }]}>Emergency Options</Text>

            <TouchableOpacity
              style={[styles.modalOption, {backgroundColor: '#ff3b30', color: '#fff'}]}
              onPress={() => {
                setShowEmergencyModal(false);
                callNumber(911);
                Alert.alert('🚨 Calling emergency services...');
              }}
            >
              <Text style={styles.modalOptionText}>Call Emergency Services</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalOption, { backgroundColor: '#8528ffff' }]}
              onPress={() => {
                setShowEmergencyModal(false);
                notifyGroupEmergency();
              }}
            >
              <Text style={[styles.modalOptionText, { color: '#ffffffff' }]}>Notify Group</Text>
            </TouchableOpacity>

            {trustedContacts.map((contact, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.modalOption, { backgroundColor: '#00b9d1', color: '#fff' }]}
                onPress={() => callNumber(contact.phone)}
              >
                <Text style={styles.modalOptionText}>
                  Call {contact.name || 'Unnamed'}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.modalOption, { backgroundColor: '#ccc' }]}
              onPress={() => setShowEmergencyModal(false)}
            >
              <Text style={[styles.modalOptionText, { color: '#333' }]}>Cancel</Text>
            </TouchableOpacity>
            
          </View>
        </View>
      )}

      <LinearGradient
        colors={[gradientBottom, gradientTop]} 
        style={[styles.background, { opacity }]}
      >
        <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.darkOverlay} />

        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => setShowEmergencyModal(true)}
        >
          <Text style={styles.emergencyButtonText}>Emergency</Text>
        </TouchableOpacity>

        {isEmergencyActive && (
          <View style={styles.emergencyBanner}>
            <Text style={styles.emergencyBannerText}>Emergency Activated</Text>
            <TouchableOpacity
              style={styles.emergencyBannerButton}
              onPress={cancelGroupEmergency}
            >
              <Text style={styles.emergencyBannerButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {isEmergencyActive && (
          <View style={{...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)',zIndex: 1500,}} pointerEvents="auto" />
        )}

        <View style={styles.container}>
          
          <View style={[styles.topRow]}>
            <LinearGradient
              colors={["#3000dbff", "#ad09eeff"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.gradientBorder, {marginRight: 10}]}
            >
            <View style={[styles.module, { backgroundColor: moduleBackground}]}>
              <Text style={[styles.moduleLabel, { color: altTextColor, marginBottom: -8 }]}>Speed</Text>
              <Text
                style={[
                  styles.moduleValue,
                  { color: interpolateColor(speed, currentLimit), textShadowColor: textOutline, marginBottom: -8 },
                ]}
              >
                {Math.round(speed)} 
              </Text>
              <Text
                style={[
                  styles.moduleLabel,
                  { color: altTextColor, textShadowColor: textOutline, fontSize: 20 },
                ]}
              >
                {unit.toUpperCase()}
              </Text>
            </View>
            </LinearGradient>
            
            <LinearGradient
              colors={["#3000dbff", "#ad09eeff"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.gradientBorder, {marginLeft: 10}]}
            >
            <View style={[styles.module, { backgroundColor: moduleBackground}]}>
              <Animated.View
                pointerEvents="none"
                style={{
                  ...StyleSheet.absoluteFillObject,
                  backgroundColor: "#ff0000c2",
                  borderRadius: 12, 
                  opacity: pulseOverlayAnim,
                }}
              />
              <Text style={[styles.moduleLabel, { color: altTextColor, marginBottom: -8 }]}>Limit</Text>
              
              <Text
                style={[
                  styles.moduleValue,
                  { color: textColor, textShadowColor: textOutline, marginBottom: -8 },
                ]}
              >
                {Math.round(currentLimit)}
              </Text>
              <Text
                style={[
                  styles.moduleLabel,
                  { color: altTextColor, textShadowColor: textOutline, fontSize: 20 },
                ]}
              >
                {unit.toUpperCase()}
              </Text>
            </View>
            </LinearGradient>
          </View>

          <LinearGradient
            colors={["#3000dbff", "#ad09eeff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBorderWide}
          >
          <View style={[styles.moduleWideRow, { backgroundColor: moduleBackground }]}>
            
            <View style={[styles.module, {height: 175, justifyContent: "center"}]}>
              {!weather ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.loadingText}>Loading weather data...</Text>
                </View>
              ) : (
                <View style={styles.weatherBox}>
                    <Text style={styles.weatherText}>
                      <MaterialCommunityIcons
                        name={getWeatherIconName(weather.current.weathercode)}
                        size={28}
                        color="white"
                        style={{ marginBottom: 6 }}
                      />
                      Condition: {weatherCodeMap[weather.current.weathercode] || "Unknown"}
                    </Text>
                    <Text style={styles.weatherText}>
                      Now: {Math.round(weather.current.temperature_2m)}°F
                    </Text>
                    <Text style={styles.weatherText}>
                      High: {Math.round(weather.daily.temperature_2m_max[0])}°F | 
                      Low: {Math.round(weather.daily.temperature_2m_min[0])}°F
                    </Text>
                    <Text style={styles.weatherText}>
                      Wind: {Math.round(weather.current.windspeed_10m)} mph
                    </Text>
                    <Text style={styles.weatherText}>
                      Precipitation: {weather.current.precipitation} in
                    </Text>
                    <Text style={styles.weatherText}>
                      Chance of Rain: {weather.current.precipitation_probability}%
                    </Text>
                    <Text style={styles.weatherText}>
                      Visibility: {Math.round(weather.current.visibility / 1609)} mi
                    </Text>
                    
                </View>
              )}
            </View>
            
          </View>
          </LinearGradient>
          
          <LinearGradient
            colors={["#3000dbff", "#ad09eeff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBorderWide}
          >
          <View style={[styles.moduleWideRow, { backgroundColor: moduleBackground }]}>
            <View style={styles.subModule}>
              <Text style={[styles.moduleLabel, { color: altTextColor, fontSize: 18 }]}>Points</Text>
              <Text
                style={[
                  styles.moduleValue,
                  { color: textColor, textShadowColor: textOutline, fontSize: 45 },
                ]}
              >
                {displayedPoints}
              </Text>
            </View>

            <View style={styles.subModule}>
              <Text style={[styles.moduleLabel, { color: altTextColor, fontSize: 18 }]}>
                Distractions
              </Text>
              <Text
                style={[
                  styles.moduleValue,
                  { color: textColor, textShadowColor: textOutline, fontSize: 45 },
                ]}
              >
                {distractedCount}
              </Text>
            </View>
            <View style={styles.subModule}>
              <Text style={[styles.moduleLabel, { color: altTextColor, fontSize: 18 }]}>Streak</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 2*(Math.abs(streak).toString().length - 1) }}>
              <Image
                source={getFireImage(streak)}
                style={{ width: 32, height: 32, marginRight: 2, marginTop: 6 }}
                resizeMode="contain"
              />
              <Text
                style={[
                  styles.moduleValue,
                  { color: textColor, textShadowColor: textOutline, fontSize: 45 - 5*(Math.abs(streak).toString().length - 1) },
                ]}
              >
                {streak ?? 0}
              </Text>
              </View>
            </View>
          </View>
          </LinearGradient>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            onPress={async () => {
              await finalizeDrive();
              navigation.goBack();
            }}
            style={[styles.completeButton, { backgroundColor: buttonColor }]}
          >
            <Text style={styles.completeButtonText}>Complete Drive</Text>
          </TouchableOpacity>
        </View>

      </LinearGradient>
    </>
  );
}

//styles
const styles = StyleSheet.create({
  background: { flex: 1, padding: 20 },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0)',
  },
  emergencyButton: {
    position: 'relative',
    top: height/12,
    backgroundColor: '#ff3b30',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    zIndex: 1000,
    elevation: 10,
    width: "35%"
  },

  emergencyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },

  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },

  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: (width / 375) * 20,
    alignItems: 'center',
    elevation: 10,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },

  modalOption: {
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
    width: '100%',
  },

  modalText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 0,
  },

  modalOptionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  
  screenTitle: {
    marginTop: height/12,
    fontSize: 36,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },

  gradientBorder: {
    marginTop: 20,
    padding: 3,
    borderRadius: 18,
    flex: 1,
    height: 175
  },

  gradientBorderWide: {
    marginTop: 20,
    padding: 3,
    borderRadius: 18,
  },
  
  topRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: height/20
  },

  module: {
    flex: 1,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  moduleLabel: {
    fontSize: 26,
    fontWeight: "600",
    color: "#bbb",
  },

  moduleValue: {
    fontSize: 75,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 5,
  },

  completeButton: {
    width: "100%",
    backgroundColor: "#0000007c",
    paddingVertical: 15,
    borderRadius: 20,
    marginBottom: height/30,
    alignItems: "center",
    alignSelf: "center",
  },

  completeButtonText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },

  moduleWideRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 15,
    paddingHorizontal: 10,
    borderRadius: 16,
    width: "100%",
    alignSelf: "center",
  },

  subModule: {
    flex: 1,
    alignItems: "center",
  },

  speedLimitContainer: {
    position: 'absolute',
    top: (height / 667) * 45,
    right: (width / 375) * 10,
    width: (width / 375) * 100,
    height: (width / 375) * 100,
  },
  speedLimitSign: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedLimitText: {
    paddingTop: (height / 667) * 35,
    fontSize: 36,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  emergencyBanner: {
    position: 'absolute',
    top: (height / 667) * 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ff3b30',
    paddingVertical: 20,
    paddingHorizontal: 16,
    zIndex: 2000,
    elevation: 20,
  },
  emergencyBannerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emergencyBannerButton: {
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  emergencyBannerButtonText: {
    color: '#ff3b30',
    fontWeight: 'bold',
    fontSize: 14,
  },

  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: (height / 667) * 25,
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
    marginTop: (height / 667) * 100,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: '#0000007a',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
    textAlign: 'center',
  },
  pointsLabel: {
    fontSize: (width / 375) * 24,
    color: '#fff',
    marginTop: (height / 667) * -20,
  },
  completeDriveButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  completeDriveButtonWrapper: {
    marginTop: (height / 667) * 0,
    marginBottom: (height / 667) * 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  speedBackground: {
    width: '100%',
    height: height * 1/3.1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: (height / 667) * -50,
    borderRadius: (width / 375) * 20,
    overflow: 'hidden',
  },
  speedText: {
    fontSize: (width / 375) * 48,
    fontWeight: 'bold',
    fontFamily: 'Arial Rounded MT Bold',
    color: '#fff',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: (width / 375) * 4,
    marginBottom: (height / 667) *0,
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
    fontSize: (width / 375) * 32,
    fontWeight: 'bold',
    color: '#ff4444',
    textAlign: 'center',
    paddingHorizontal: (width / 375) * 20,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: (width / 375) * 6,
  },
});
