// DashboardScreen.js
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Pressable,
  ImageBackground,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Easing } from 'react-native';
import { Snackbar } from 'react-native-paper';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { getUserPoints, saveUserPoints } from '../utils/firestore';

import { ThemeContext } from '../context/ThemeContext'; 

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const scale = (size) => (SCREEN_WIDTH / 375) * size;
const verticalScale = (size) => (SCREEN_HEIGHT / 812) * size;

const getStorageKey = (uid) => `totalPoints_${uid}`;

export default function DashboardScreen({ route }) {
  const navigation = useNavigation();
  const { resolvedTheme } = useContext(ThemeContext); 

  const [user, setUser] = useState(null);
  const [totalPoints, setTotalPoints] = useState(null);
  const updatedPointsHandled = useRef(false);

  const animatedPoints = useRef(new Animated.Value(0)).current;
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const snackbarBackgroundColor = resolvedTheme === 'dark' ? '#222' : '#fff';
  const snackbarTextColor = resolvedTheme === 'dark' ? '#fff' : '#555';

  useEffect(() => {
    const listener = animatedPoints.addListener(({ value }) => {
      setDisplayedPoints(Math.floor(value));
    });
    return () => animatedPoints.removeListener(listener);
  }, [animatedPoints]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      updatedPointsHandled.current = false;
      setTotalPoints(null);
      animatedPoints.setValue(0);
      setDisplayedPoints(0);

      if (firebaseUser) {
        setUser(firebaseUser);
        const uid = firebaseUser.uid;
        try {
          const firestorePoints = await getUserPoints(uid);
          if (firestorePoints == null || isNaN(firestorePoints)) {
            setTotalPoints(0);
            animatedPoints.setValue(0);
            await AsyncStorage.removeItem(getStorageKey(uid));
            return;
          }
          await AsyncStorage.setItem(getStorageKey(uid), firestorePoints.toString());
          setTotalPoints(firestorePoints);
          animatedPoints.setValue(firestorePoints);
        } catch (e) {
          console.error('Error fetching points on auth change:', e);
          setTotalPoints(0);
          animatedPoints.setValue(0);
        }
      } else {
        setUser(null);
        setTotalPoints(0);
        animatedPoints.setValue(0);
      }

      fadeInContent();
    });

    return unsubscribe;
  }, [animatedPoints]);

  const fadeInContent = useCallback(() => {
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.poly(3)),
      useNativeDriver: true,
    }).start();
  }, [contentOpacity]);

  const fadeOutContent = () =>
    new Promise((resolve) => {
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.poly(3)),
        useNativeDriver: true,
      }).start(() => resolve());
    });

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      fadeInContent();

      (async () => {
        if (!user) {
          if (isActive) {
            setTotalPoints(0);
            animatedPoints.setValue(0);
          }
          return;
        }

        try {
          const key = getStorageKey(user.uid);
          const [storedStr, drivePointsStr] = await Promise.all([
            AsyncStorage.getItem(key),
            AsyncStorage.getItem('@pointsThisDrive'),
          ]);

          const storedPoints = storedStr ? parseFloat(storedStr) : 0;
          const drivePoints = drivePointsStr ? parseFloat(drivePointsStr) : 0;
          const newTotal = storedPoints + drivePoints;

          if (!isActive) return;

          setTotalPoints(newTotal);
          animatePoints(displayedPoints, newTotal);

          if (drivePoints > 0) {
            await AsyncStorage.setItem(key, newTotal.toString());
            await AsyncStorage.removeItem('@pointsThisDrive');
            await saveUserPoints(user.uid, newTotal);
          }
        } catch (e) {
          console.error('Error loading points on focus:', e);
          if (isActive) {
            setTotalPoints(0);
            animatedPoints.setValue(0);
          }
        }
      })();

      return () => {
        isActive = false;
        updatedPointsHandled.current = false;
      };
    }, [user, displayedPoints, fadeInContent, animatedPoints])
  );

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      (async () => {
        try {
          const flag = await AsyncStorage.getItem('@driveCompleteSnackbar');
          if (flag === 'true' && isActive) {
            setSnackbarVisible(true);
            await AsyncStorage.removeItem('@driveCompleteSnackbar');
          }
        } catch (e) {
          console.warn('Error checking drive complete flag', e);
        }
      })();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const animatePoints = useCallback(
    (from, to) => {
      const diff = Math.abs(to - from);
      const duration = Math.min(1000, Math.max(500, diff * 20));
      animatedPoints.setValue(from);
      Animated.timing(animatedPoints, {
        toValue: to,
        duration,
        easing: Easing.out(Easing.poly(3)),
        useNativeDriver: false,
      }).start();
    },
    [animatedPoints]
  );

  useEffect(() => {
    const updated = route.params?.updatedPoints;
    if (updated != null && !updatedPointsHandled.current) {
      animatePoints(displayedPoints, updated);
      setTotalPoints(updated);

      (async () => {
        if (user) {
          const key = getStorageKey(user.uid);
          await AsyncStorage.setItem(key, updated.toString());
          await saveUserPoints(user.uid, updated);
        } else {
          await AsyncStorage.setItem('totalPoints', updated.toString());
        }
      })();

      updatedPointsHandled.current = true;
      navigation.setParams({ updatedPoints: null });
    }
  }, [route.params?.updatedPoints, user, animatePoints, displayedPoints, navigation]);

  useEffect(() => {
    if (route.params?.showDriveCompleteSnackbar) {
      setSnackbarVisible(true);
      navigation.setParams({ showDriveCompleteSnackbar: false });
    }
  }, [route.params, navigation]);

  const AnimatedButton = ({ onPress, children, containerStyle, style }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
        style={containerStyle}
      >
        <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>{children}</Animated.View>
      </Pressable>
    );
  };

  if (totalPoints === null) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading Points...</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.flex, { opacity: contentOpacity }]}>
      <ImageBackground
        source={require('../assets/dashback.jpg')}
        style={styles.background}
        resizeMode="cover"
      >
        <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.darkOverlay} />

        <View style={styles.overlay}>
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.openDrawer()}>
            <Ionicons name="menu" size={32} color="#fff" />
          </TouchableOpacity>

          {!user && (
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => {
                fadeOutContent().then(() => navigation.navigate('Login'));
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.loginButtonText}>Log In</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.header}>Dashboard</Text>

          <ImageBackground
            source={require('../assets/dashboard.png')}
            style={styles.pointsBackground}
            resizeMode="cover"
          >
            <Text style={styles.points} adjustsFontSizeToFit numberOfLines={1}>
              {displayedPoints}
            </Text>
            <Text style={styles.pointsLabel}>Points</Text>
          </ImageBackground>

          <AnimatedButton
            style={styles.driveButton}
            onPress={() => {
              fadeOutContent().then(() =>
                navigation.navigate('Drive', {
                  totalPoints,
                })
              );
            }}
          >
            <Text style={styles.driveButtonText}>Start Driving!</Text>
          </AnimatedButton>

          <View style={styles.row}>
            <AnimatedButton
              containerStyle={styles.flexItem}
              style={styles.smallButton}
              onPress={() => {
                fadeOutContent().then(() => navigation.navigate('Rewards', { totalPoints }));
              }}
            >
              <Text style={styles.smallButtonText}>Rewards</Text>
            </AnimatedButton>

            <AnimatedButton
              containerStyle={styles.flexItem}
              style={styles.smallButton}
              onPress={() => {
                fadeOutContent().then(() => navigation.navigate('Leaderboard'));
              }}
            >
              <Text style={styles.smallButtonText}>Leaderboard</Text>
            </AnimatedButton>
          </View>

          <Snackbar
            visible={snackbarVisible}
            onDismiss={() => setSnackbarVisible(false)}
            duration={3000}
            style={{ backgroundColor: snackbarBackgroundColor }}
            theme={{
              colors: {
                onSurface: snackbarTextColor, 
              },
            }}
          >
            <Text style={{ color: snackbarTextColor, textAlign: 'center', width: '100%', fontSize: 24 }}>
              🎉 Drive Complete! 🎉
            </Text>
          </Snackbar>
        </View>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: '#fff', fontSize: scale(24) },
  background: { flex: 1 },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  overlay: {
    flex: 1,
    padding: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    position: 'absolute',
    top: verticalScale(70),
    left: scale(30),
  },
  loginButton: {
    position: 'absolute',
    top: verticalScale(70),
    right: scale(30),
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(14),
    borderRadius: scale(16),
  },
  loginButtonText: {
    color: '#fff',
    fontSize: scale(16),
    fontWeight: '600',
  },
  header: {
    fontSize: scale(56),
    fontWeight: '500',
    marginBottom: verticalScale(30),
    color: '#fff',
  },
  pointsBackground: {
    width: '100%',
    height: verticalScale(250),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(40),
    borderRadius: scale(20),
    overflow: 'hidden',
  },
  points: {
    fontSize: scale(64),
    fontWeight: 'bold',
    marginTop: verticalScale(90),
    marginBottom: verticalScale(4),
    maxWidth: '60%',
    textAlign: 'center',
    color: '#fff',
    textShadowColor: '#fff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  pointsLabel: {
    fontSize: scale(20),
    marginBottom: verticalScale(40),
    color: '#fff',
  },
  driveButton: {
    backgroundColor: 'transparent',
    borderColor: '#fff',
    borderWidth: 2,
    paddingVertical: verticalScale(20),
    paddingHorizontal: scale(40),
    borderRadius: scale(20),
    width: '100%',
    marginBottom: verticalScale(32),
    alignItems: 'center',
  },
  driveButtonText: {
    color: '#fff',
    fontSize: scale(30),
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    columnGap: scale(16),
    marginTop: verticalScale(30),
  },
  smallButton: {
    flex: 1,
    minHeight: verticalScale(70),
    borderColor: '#fff',
    borderWidth: 2,
    backgroundColor: 'transparent',
    paddingVertical: verticalScale(10),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: {
    fontSize: scale(20),
    fontWeight: '600',
    color: '#fff',
  },
  flexItem: { flex: 1, justifyContent: 'center' },
});
