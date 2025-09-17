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


const db = getFirestore();

const { width, height } = Dimensions.get('window');

const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);
const GRID_RESOLUTION = 0.002;
const speedLimitCache = new Map();
let lastSpeedLimitFetchTime = 0;

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

  const DEFAULT_SPEED_LIMIT_MPH = 25;
  const DEFAULT_SPEED_LIMIT_KPH = DEFAULT_SPEED_LIMIT_MPH * 1.60934;
  const DEFAULT_DELAY = 1000;
  const speedThreshold = unit === 'kph' ? 16.0934 : 10;

  const { setDriveJustCompleted } = useDrive();

  const { resolvedTheme } = useContext(ThemeContext);

  const isDarkMode = resolvedTheme === 'dark';

  const modalBackgroundColor = isDarkMode ? '#222' : '#fff'; 
  const titleTextColor = isDarkMode ? '#fff' : '#000'; 
  const contentTextColor = isDarkMode ? '#eee' : '#000';     
  const buttonBackgroundColor = isDarkMode ? '#444' : '#000'; 
  const buttonTextColor = isDarkMode ? '#fff' : '#fff';   

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
          const lat = coordinates[0];
          const lon = coordinates[1];

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
          } else if (Date.now() - lastSpeedLimitFetchTime > 15000 && showSpeedLimit) {
            lastSpeedLimitFetchTime = Date.now();
            const sl = await fetchSpeedLimit(lat, lon, unit);
            if (sl !== null) {
              speedLimitCache.set(gridKey, { value: sl, unit: unit }); 
              setSpeedLimit(sl);
              await saveSpeedLimitCache();
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

        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => setShowEmergencyModal(true)}
        >
          <Text style={styles.emergencyButtonText}>Emergency</Text>
        </TouchableOpacity>

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
          <View style={styles.pointsContainer}>
            <View style={styles.pointsWrapper}>
              <Text style={[styles.points, { fontSize: getFontSizeForPoints(displayedPoints) }]}>
                {displayedPoints}
              </Text>
            </View>
            <Text style={styles.pointsLabel}>Points</Text>
          </View>

          <View style={styles.completeDriveButtonWrapper}>
            <TouchableOpacity
              onPress={async () => {
                await finalizeDrive();
                navigation.goBack();
              }}
              style={styles.button}
            >
              <Text style={styles.completeDriveButton}>Complete Drive</Text>
            </TouchableOpacity>
          </View>

          {showCurrentSpeed && (
            <ImageBackground
              source={require('../assets/dashboard.png')}
              style={styles.speedBackground}
              resizeMode="stretch"
              imageStyle={{ borderRadius: 20 }}
            >
              <Text style={styles.speedText}>
                {Math.round(speed)} {unit.toUpperCase()}
              </Text>
            </ImageBackground>
          )}
        </View>
      </AnimatedImageBackground>
    </>
  );
}

//styles
const styles = StyleSheet.create({
  background: { flex: 1 },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0)',
  },
  emergencyButton: {
    position: 'absolute',
    top: (height / 667) * 45,
    left: (width / 375) * 20,
    backgroundColor: '#ff3b30',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    zIndex: 1000,
    elevation: 10,
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

  completeDriveButton: {
    backgroundColor: '#0000007c',
    outlineColor: '#ffffff',
    outlineWidth: 2,
    paddingVertical: (height / 667) * 15,
    paddingHorizontal: (width / 375) * 60,
    marginTop: (height / 667) * 0,
    marginBottom: (height / 667) * 60,
    borderRadius: (width / 375) * 20,
    fontWeight: 'bold',
    fontSize: (width / 375) * 24,
    fontFamily: 'Arial Rounded MT Bold',
    color: '#ffffff',
    overflow: 'hidden',
    textAlign: 'center',
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
