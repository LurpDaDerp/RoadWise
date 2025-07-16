// DashboardScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Pressable,
  ImageBackground,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Easing } from 'react-native';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { getUserPoints, saveUserPoints } from '../utils/firestore';

const getStorageKey = (uid) => `totalPoints_${uid}`;

export default function DashboardScreen({ route }) {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [totalPoints, setTotalPoints] = useState(null);
  const updatedPointsHandled = useRef(false);

  const animatedPoints = useRef(new Animated.Value(0)).current;
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Listen for animation value changes
  useEffect(() => {
    const listener = animatedPoints.addListener(({ value }) => {
      setDisplayedPoints(Math.floor(value));
    });
    return () => animatedPoints.removeListener(listener);
  }, []);

  // Listen for auth changes
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
  }, []);

  // Fade helpers
  const fadeInContent = () => {
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.poly(3)),
      useNativeDriver: true,
    }).start();
  };

  const fadeOutContent = () =>
    new Promise((resolve) => {
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.poly(3)),
        useNativeDriver: true,
      }).start(() => resolve());
    });

  // On focus, reload points from storage
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      fadeInContent();

      (async () => {
        if (user) {
          try {
            const key = getStorageKey(user.uid);
            const [stored, drivePointsStr] = await Promise.all([
              AsyncStorage.getItem(key),
              AsyncStorage.getItem('@pointsThisDrive'),
            ]);
            const storedPoints = stored ? parseFloat(stored) : 0;
            const drivePoints = drivePointsStr ? parseFloat(drivePointsStr) : 0;

            const newTotal = storedPoints + drivePoints;
            setTotalPoints(newTotal);
            animatePoints(0, newTotal);

            if (drivePoints > 0) {
              await AsyncStorage.setItem(key, newTotal.toString());
              await AsyncStorage.removeItem('@pointsThisDrive');
              if (user) {
                await saveUserPoints(user.uid, newTotal);
                console.log("points updated 1");
              }
            }

            if (!isActive) return;

            // <-- Removed resetting to storedPoints here --

          } catch (e) {
            console.error('Error loading points on focus:', e);
            if (!isActive) return;
            setTotalPoints(0);
            animatedPoints.setValue(0);
          }
        } else {
          if (!isActive) return;
          setTotalPoints(0);
          animatedPoints.setValue(0);
        }
      })();


      return () => {
        isActive = false;
        updatedPointsHandled.current = false;
      };
    }, [user])
  );

  // Animate points smoothly
  const animatePoints = (from, to) => {
    const diff = Math.abs(to - from);
    const duration = Math.min(1000, Math.max(500, diff * 20)); // Clamp between 500ms and 2000ms
    animatedPoints.setValue(from);
    Animated.timing(animatedPoints, {
      toValue: to,
      duration,
      easing: Easing.out(Easing.poly(3)),
      useNativeDriver: false,
    }).start();
  };

  // Animate after receiving updated points from DriveScreen
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
          console.log("points updated 2");
        } else {
          await AsyncStorage.setItem('totalPoints', updated.toString());
        }
      })();

      updatedPointsHandled.current = true;
      navigation.setParams({ updatedPoints: null });
    }
  }, [route.params?.updatedPoints, user]);

  const navigateWithFadeOut = async (screenName, params) => {
    await fadeOutContent();
    navigation.navigate(screenName, params);
  };

  const AnimatedButton = ({ onPress, children, containerStyle, style }) => {
    const scale = useRef(new Animated.Value(1)).current;
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
        style={containerStyle}
      >
        <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
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
              onPress={() => navigateWithFadeOut('Login')}
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
            onPress={() =>
              navigateWithFadeOut('Drive', {
                totalPoints,
              })
            }
          >
            <Text style={styles.driveButtonText}>Start Driving!</Text>
          </AnimatedButton>

          <View style={styles.row}>
            <AnimatedButton
              containerStyle={styles.flexItem}
              style={styles.smallButton}
              onPress={() => navigateWithFadeOut('Rewards', { totalPoints })}
            >
              <Text style={styles.smallButtonText}>Rewards</Text>
            </AnimatedButton>

            <AnimatedButton
              containerStyle={styles.flexItem}
              style={styles.smallButton}
              onPress={() => navigateWithFadeOut('Leaderboard')}
            >
              <Text style={styles.smallButtonText}>Leaderboard</Text>
            </AnimatedButton>
          </View>
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
  loadingText: { color: '#fff', fontSize: 24 },
  background: { flex: 1 },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  overlay: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: { position: 'absolute', top: 70, left: 30 },
  loginButton: {
    position: 'absolute',
    top: 70,
    right: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  header: { fontSize: 56, fontWeight: '500', marginBottom: 24, color: '#fff' },
  pointsBackground: {
    width: '100%',
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  points: {
    fontSize: 64,
    fontWeight: 'bold',
    marginTop: 90,
    marginBottom: 4,
    maxWidth: '60%',
    textAlign: 'center',
    color: '#fff',
    textShadowColor: '#fff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  pointsLabel: { fontSize: 20, marginBottom: 40, color: '#fff' },
  driveButton: {
    backgroundColor: 'transparent',
    borderColor: '#fff',
    borderWidth: 2,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 20,
    width: '100%',
    marginBottom: 32,
    alignItems: 'center',
  },
  driveButtonText: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    columnGap: 16,
    marginTop: 30,
  },
  smallButton: {
    flex: 1,
    minHeight: 70,
    borderColor: '#fff',
    borderWidth: 2,
    backgroundColor: 'transparent',
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: { fontSize: 20, fontWeight: '600', color: '#fff' },
  flexItem: { flex: 1, justifyContent: 'center' },
});
