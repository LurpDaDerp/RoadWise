// DashboardScreen.js
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  View,
  Text,
  Image,
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
import ConfettiCannon from "react-native-confetti-cannon";

import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { getUserPoints, saveUserPoints, saveUserStreak } from '../utils/firestore';

import { ThemeContext } from '../context/ThemeContext'; 

import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firestore = getFirestore();

const { width, height } = Dimensions.get('window');

const getStorageKey = (uid) => `totalPoints_${uid}`;

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
  const[snackbarColor, setSnackBarColor] = useState();

  const snackbarBackgroundColor = resolvedTheme === 'dark' ? '#222' : '#fff';
  const snackbarTextColor = resolvedTheme === 'dark' ? '#fff' : '#555';

  const [driveStreak, setDriveStreak] = useState(0);

  const confettiRef = useRef(null);
  const [confettiVisible, setConfettiVisible] = useState(false);

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
          } else {
            await AsyncStorage.setItem(getStorageKey(uid), firestorePoints.toString());
            setTotalPoints(firestorePoints);
            animatePoints(0, firestorePoints); 
          }

          const docSnap = await getDoc(doc(firestore, 'users', uid));
          setStreak(docSnap.exists() ? docSnap.data().drivingStreak || 0 : 0);

        } catch (e) {
          console.error('Error fetching data on auth change:', e);
          setTotalPoints(0);
          animatedPoints.setValue(0);
          setStreak(0); 
        }
      } else {
        setUser(null);
        setTotalPoints(0);
        animatedPoints.setValue(0);

        const stored = await AsyncStorage.getItem('@drivingStreak');
        setStreak(stored ? parseInt(stored, 10) : 0);
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

  const [snackbarMessage, setSnackbarMessage] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      (async () => {

        try {
          const [driveCompleteFlag, wasDistractedFlag] = await Promise.all([
            AsyncStorage.getItem('@driveCompleteSnackbar'),
            AsyncStorage.getItem('@driveWasDistracted'),
          ]);

          if (driveCompleteFlag === 'true' && isActive) {
            if (wasDistractedFlag === 'true') {
              setSnackbarMessage('Streak reset. You were distracted!');
              setSnackBarColor('#ff0000ff');
            } else {
              setSnackbarMessage('Drive complete. You were undistracted!');
              setSnackBarColor('#00ff15ff');
            }
            setSnackbarVisible(true);
            setConfettiVisible(false);
            setTimeout(() => {
              if (!isActive) return;
              setConfettiVisible(true);
            }, 50);
          }

          await AsyncStorage.multiRemove(['@driveCompleteSnackbar', '@driveWasDistracted']);
        } catch (e) {
          console.warn('Error checking drive complete or distraction flags', e);
        }
      })();

      return () => {
        isActive = false;
      };
    }, [])
  );

  useEffect(() => {
    if (confettiVisible && confettiRef.current) {
      confettiRef.current.start();
    }
  }, [confettiVisible]);

  const animatePoints = (from, to) => {
    const pointDifference = Math.abs(to - from);
    
    const duration = 25;

    Animated.timing(animatedPoints, {
      toValue: to,
      duration,
      useNativeDriver: false,
    }).start();
  };

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

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const syncStreak = async () => {
        try {
          const flag = await AsyncStorage.getItem('@streakThisDrive');
          if (flag === '1' && isActive) {
            let currentStreak = 0;

            if (user) {
              const userId = user?.uid;
              const stored = await AsyncStorage.getItem(`@drivingStreak_${userId}`);
              currentStreak = stored ? parseInt(stored, 10) : 0;

              await saveUserStreak(user.uid, currentStreak);
              setDriveStreak(currentStreak);

            } else {
              const stored = await AsyncStorage.getItem('drivingStreak');
              currentStreak = stored ? parseInt(stored, 10) : 0;

              const updatedStreak = currentStreak + 1;

              await AsyncStorage.setItem('drivingStreak', updatedStreak.toString());
              setDriveStreak(updatedStreak);
            }

            await AsyncStorage.removeItem('@streakThisDrive');
          }
        } catch (e) {
          console.warn('Error syncing drive streak:', e);
        }
      };

      syncStreak();

      return () => {
        isActive = false;
      };
    }, [user])
  );



  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const loadStreak = async () => {
        if (user) {
          const docSnap = await getDoc(doc(firestore, 'users', user.uid));
          setStreak(docSnap.exists() ? docSnap.data().drivingStreak || 0 : 0);
        } else {
          const stored = await AsyncStorage.getItem('@drivingStreak');
          setStreak(stored ? parseInt(stored, 10) : 0);
        }
      };
      
      loadStreak();
    }, [user])
  );

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
        <BlurView intensity={5} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.darkOverlay} />

        <View style={styles.overlay}>
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.openDrawer()}>
            <Ionicons name="menu" size={32} color="#fff" />
          </TouchableOpacity>
                      
          {user ? (
            <View style={styles.streakContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image source={getFireImage(streak)} style={styles.streakImage} />
                <Text style={styles.streakText}>
                  {streak} 
                </Text>
              </View>

            </View>
          ) : (
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
            {totalPoints !== null ? (
              <Text style={styles.points} adjustsFontSizeToFit numberOfLines={1}>
                {displayedPoints}
              </Text>
            ) : (
              <Text style={styles.points} adjustsFontSizeToFit numberOfLines={1}>
                ...
              </Text>
            )}

            <Text style={styles.pointsLabel}>Points</Text>
          </ImageBackground>

          <TouchableOpacity
            style={styles.driveButton}
            onPress={() => {
              fadeOutContent().then(() =>
                navigation.navigate('Drive', { totalPoints })
              );
            }}
          >
            <ImageBackground
              source={require('../assets/drivebutton.jpeg')}
              style={styles.buttonImage} 
              imageStyle={{ borderRadius: width / 18}}
              resizeMode="cover"
            >
              <BlurView intensity={5} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.buttonDarkOverlay} />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.driveButtonText}>Start Driving!</Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.driveButton}
            onPress={() => {
              fadeOutContent().then(() =>
                navigation.navigate('AIScreen')
              );
            }}
          >
            <ImageBackground
              source={require('../assets/AIbutton.jpg')}
              style={styles.buttonImage}
              imageStyle={{ borderRadius: width / 18 }} 
              resizeMode="cover"
            >
              <BlurView intensity={5} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.buttonDarkOverlay} />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.driveButtonText}>AI Coach</Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>


          <Snackbar
            visible={snackbarVisible}
            onDismiss={() => setSnackbarVisible(false)}
            duration={3000}
            style={{ backgroundColor: snackbarBackgroundColor, paddingHorizontal: 0, marginBottom: height/4, borderRadius: 20, outlineColor: snackbarColor, outlineWidth: 2 }}
            theme={{
              colors: {
                onSurface: snackbarTextColor, 
              },
            }}

            action={{
              label: 'OK',
              onPress: () => setSnackbarVisible(false),

            }}
          >
            <Text style={{ color: snackbarTextColor, textAlign: 'center', width: '100%', fontSize: 20 }}> 
              {snackbarMessage}
            </Text>
          </Snackbar>
 
          
          {confettiVisible && (
            <ConfettiCannon
              count={75}
              origin={{ x: width/2, y: -20 }}
              explosionSpeed={500}
              fallSpeed={1700}
              fadeOut
              autoStart={false}
              ref={confettiRef}
            />
          )}

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
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  buttonDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  overlay: {
    flex: 1,
    padding: width/9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    position: 'absolute',
    top: height/11,
    left: width/10,
  },
  loginButton: {
    position: 'absolute',
    top: height/11,
    right: width/10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  streakContainer: {
    position: 'absolute',
    top: height/13,
    right: width/11,
    backgroundColor: 'rgba(255,255,255,0.0)',
  },
  streakText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
    fontFamily: 'futura',
  },
  streakImage: {
    width: 40,
    height: 40,
    marginRight: 6,
  },
  header: {
    fontSize: width/8,
    fontWeight: '500',
    fontFamily: 'Arial Rounded MT Bold',
    marginTop: height/10,
    marginBottom: height/25,
    color: '#fff',
  },
  pointsBackground: {
    width: '100%',
    height: height/3.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: height/20,
    borderRadius: width/30,
    overflow: 'hidden',
  },
  points: {
    fontSize: width/6,
    fontWeight: 'bold',
    marginTop: height/11,
    marginBottom: 0,
    maxWidth: '60%',
    textAlign: 'center',
    color: '#fff',
    textShadowColor: '#fff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    fontFamily: 'futura',
  },
  pointsLabel: {
    fontSize: width/18,
    marginBottom: height/20,
    color: '#fff',
  },
  driveButton: {
    width: '100%',
    height: 75,
    borderRadius: width / 18,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    marginBottom: height / 48,
  },
  
  driveButtonText: {
    color: '#fff',
    fontSize: width/14,
    fontWeight: 'bold',
    fontFamily: 'Arial Rounded MT Bold',
  },
  buttonImage: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
  },
  buttonTextContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    columnGap: width/18,
  },
  smallButton: {
    flex: 1,
    minHeight: height/11,
    borderColor: '#fff',
    backgroundColor: '#0000007c',
    borderWidth: 2,
    paddingVertical: width/60,
    borderRadius: width/20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: {
    fontSize: width/21,
    fontWeight: '600',
    fontFamily: 'Arial Rounded MT Bold',
    color: '#fff',
  },
  flexItem: { flex: 1, justifyContent: 'center' },
});
