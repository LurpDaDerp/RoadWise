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
  ScrollView,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Easing } from 'react-native';
import { Snackbar } from 'react-native-paper';
import ConfettiCannon from "react-native-confetti-cannon";
import { LinearGradient } from 'expo-linear-gradient';

import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { getUserPoints, saveUserPoints, saveUserStreak, getUsername, getTotalDrivesNumber } from '../utils/firestore';


import { ThemeContext } from '../context/ThemeContext'; 
import dashboardDark from '../assets/dashboard.png';
import dashboardLight from '../assets/dashboardlight.png';

import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firestore = getFirestore();

const { width, height } = Dimensions.get('window');

const getStorageKey = (uid) => `totalPoints_${uid}`;

const db = getFirestore();

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

function interpolateColor(percent) {
  const p = Math.min(Math.max(percent, 0), 100) / 100;
  const start = { r: 255, g: 0, b: 0 };
  const mid   = { r: 255, g: 255, b: 0 };
  const end   = { r: 0, g: 225, b: 0 };

  let r, g, b;
  if (p < 0.5) {
    const t = p / 0.5;
    r = Math.round(start.r + (mid.r - start.r) * t);
    g = Math.round(start.g + (mid.g - start.g) * t);
    b = Math.round(start.b + (mid.b - start.b) * t);
  } else {
    const t = (p - 0.5) / 0.5;
    r = Math.round(mid.r + (end.r - mid.r) * t);
    g = Math.round(mid.g + (end.g - mid.g) * t);
    b = Math.round(mid.b + (end.b - mid.b) * t);
  }

  return `rgb(${r},${g},${b})`;
}



export default function DashboardScreen({ route }) {
  const navigation = useNavigation();
  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === 'dark';

  const [user, setUser] = useState(null);
  const [totalPoints, setTotalPoints] = useState(null);
  const updatedPointsHandled = useRef(false);

  const [username, setUsername] = React.useState("Guest");

  React.useEffect(() => {
    if (user?.uid) {
      getUsername(user.uid).then((name) => setUsername(name));
      getTotalDrivesNumber(user.uid).then(setTotalDrives);
    }
  }, [user]);

  const [totalDrives, setTotalDrives] = React.useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingUserData, setLoadingUserData] = useState(true);

  const animatedPoints = useRef(new Animated.Value(0)).current;
  const [displayedPoints, setDisplayedPoints] = useState(0);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const[snackbarColor, setSnackBarColor] = useState();

  const [streak, setStreak] = useState(0);
  
  const backgroundColor = isDark ? '#131313ff' : '#fff';
  const titleColor = isDark ? '#fff' : '#000';
  const textColor = isDark ? '#fff' : '#000';
  const moduleBackground = isDark ? '#222' : '#ebebebff';
  const altTextColor = isDark ? '#aaa' : '#555';
  const textOutline = isDark? 'rgba(255, 255, 255, 0.47)' : '#0000008e';
  const buttonColor = isDark ? `rgba(108, 55, 255, 1)` : `rgba(99, 71, 255, 1)`;
  const snackbarBackgroundColor = isDark ? '#222' : '#fff';
  const snackbarTextColor = isDark ? '#fff' : '#555';

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
        setLoadingUserData(true);
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


        } catch (e) {
          console.error('Error fetching data on auth change:', e);
          setTotalPoints(0);
          animatedPoints.setValue(0);
        }

        setLoadingUserData(false);

      } else {
        setUser(null);
        setTotalPoints(0);
        animatedPoints.setValue(0);
        setLoadingUserData(false);
      }

    });

    return unsubscribe;
  }, [animatedPoints]);



  const fadeInContent = useCallback(() => {
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 300,
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

      const loadUserAndFadeIn = async () => {
        if (!user) {
          setLoading(true);
          contentOpacity.setValue(0);
          return;
        }

        if (!isActive) return;

        setLoading(false);
        contentOpacity.setValue(0);
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      };

      loadUserAndFadeIn();

      return () => {
        isActive = false;
      };
    }, [user])
  );
    

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadPoints = async () => {
        if (!user) {
          if (isActive) {
            setTotalPoints(0);
            animatedPoints.setValue(0);
          }
          return;
        }

        try {
          const key = getStorageKey(user.uid);

          const [storedStr, driveStr] = await Promise.all([
            AsyncStorage.getItem(key),
            AsyncStorage.getItem('@pointsThisDrive'),
          ]);

          let total = storedStr ? parseInt(storedStr, 10) : 0;
          const drivePoints = driveStr ? parseInt(driveStr, 10) : 0;

          if (drivePoints > 0) {
            total += drivePoints;

            await AsyncStorage.setItem(key, total.toString());
            await AsyncStorage.removeItem('@pointsThisDrive');
            await saveUserPoints(user.uid, total);
          } else {
            const snap = await getDoc(doc(firestore, 'users', user.uid));
            if (snap.exists() && snap.data().points != null) {
              const remote = snap.data().points;
              if (remote > total) {
                total = remote;
                await AsyncStorage.setItem(key, total.toString());
              }
            }
          }

          if (isActive) {
            setTotalPoints(total);
            animatePoints(0, total);
          }
        } catch (e) {
          console.error('Error loading points on focus:', e);
          if (isActive) {
            setTotalPoints(0);
            animatedPoints.setValue(0);
          }
        }
      };

      loadPoints();

      return () => {
        isActive = false;
      };
    }, [user])
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
            //setSnackbarVisible(true);
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
    
    const duration = 40;

    Animated.timing(animatedPoints, {
      toValue: to,
      duration,
      useNativeDriver: false,
    }).start();
  };


  useFocusEffect(
    useCallback(() => {
      const loadStreak = async () => {
        if (user) {
          const docSnap = await getDoc(doc(firestore, 'users', user.uid));
          setStreak(docSnap.exists() ? docSnap.data().drivingStreak || 0 : 0);
        } else {
          setStreak(0);
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

  const [safetyScore, setSafetyScore] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadSafetyScore = async () => {
        try {
          const stored = await AsyncStorage.getItem("safetyScore");
          if (stored !== null && isActive) {
            setSafetyScore(parseInt(stored, 10));
          }
        } catch (err) {
          console.error("Error loading safety score:", err);
        }
      };

      loadSafetyScore();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const renderHeatBar = (score) => {
    const markerSize = 28;
    const barWidth = width * 0.8; // use ~90% of screen width
    const margin = 14;
    const usableWidth = barWidth - 2 * margin;
    const clampedScore = Math.min(Math.max(score, 0), 100);
    const markerLeft = margin + (usableWidth * clampedScore) / 100 - markerSize / 2;

    return (
      <View style={[styles.heatBarBox, { marginTop: height/16 }]}>
        <View style={[styles.heatBarContainer, { width: barWidth }]}>
          <LinearGradient
            colors={['rgba(255,0,0,1)', 'rgba(255,255,0,1)', 'rgba(0, 221, 0, 1)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heatBarBackground}
          />
          <View style={styles.markerScore}>
            <Text
              style={[
                styles.heatBarScore,
                {
                  left: markerLeft + markerSize / 2,
                  width: 50,
                  marginLeft: -25,
                  textAlign: 'center',
                  color: interpolateColor(clampedScore),
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowColor: textOutline,
                  textShadowRadius: 4
                },
              ]}
            >
              {clampedScore}
            </Text>
            <View style={[styles.heatBarMarker, { left: markerLeft }]} />
          </View>
        </View>
      </View>
    );
  };



  return (
    <Animated.View style={[styles.flex, { opacity: contentOpacity, backgroundColor }]}>
      {loading && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: backgroundColor, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <ActivityIndicator size="medium" color="#fff" />
        </View>
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.overlay}>
          <View style={styles.headerRow}>
            <View style={styles.headerContainer}>
              <Text style={[styles.header, { color: titleColor }]}>Dashboard</Text>
              <Text style={[styles.subHeader, { color: altTextColor }]}>{new Date().toDateString()}</Text>
            </View>

            {user && (
              <View style={[styles.streakBox, { backgroundColor: moduleBackground }]}>
                <Image source={getFireImage(streak)} style={styles.streakImage} />
                <Text style={[styles.streakText, { color: textColor }]}>{streak}</Text>
              </View>
            )}

            {!user && (
              <TouchableOpacity
                style={styles.loginButtonInline}
                onPress={() => fadeOutContent().then(() => navigation.navigate('Login'))}
                activeOpacity={0.7}
              >
                <Text style={styles.loginButtonText}>Log In</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.greeting, {color: textColor}]}>
            {user ? `Welcome, ${username}` : "Welcome!"}
          </Text>

          <TouchableOpacity
            style={styles.driveButton }
            onPress={() => {
              fadeOutContent().then(() =>
                navigation.navigate('Drive', { totalPoints })
              );
            }}
          >
            <ImageBackground
              source={require('../assets/drivebutton.jpeg')}
              style={styles.buttonImage} 
              imageStyle={{ borderRadius: 15,}}
              resizeMode="cover"
            >
              <BlurView intensity={5} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.buttonDarkOverlay} />
              <View style={styles.buttonTextContainer}>
                <Text style={[styles.driveButtonText, { color: "#fff" }]}>Start Driving!</Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { color: textColor, textAlign: 'left', }]}>
            My Driver Score
          </Text>
          
          <View style={[styles.safetyBox, { backgroundColor: moduleBackground }]}>

              {safetyScore !== null ? renderHeatBar(safetyScore) : (
                <TouchableOpacity
                  style={[styles.safetyButton, { backgroundColor: buttonColor }]}
                  onPress={() => navigation.navigate("AIScreen")}
                >
                  <Text style={[styles.safetyButtonText, { color: '#fff' }]}>Get Safety Score</Text>
                </TouchableOpacity>
              )}

          </View>

          <Text style={[styles.sectionTitle, { color: textColor, textAlign: 'left', }]}>
            My Stats
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 }}>
            <View style={{
              backgroundColor: moduleBackground,
              borderRadius: 15,
              padding: 12,
              alignItems: 'center',
              flex: 1,
              marginRight: 5,
            }}>
              <Text style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: textColor,
              }}>
                {totalPoints !== null ? displayedPoints : '...'}
              </Text>
              <Text style={{ fontSize: 14, color: altTextColor, marginTop: 4 }}>Points</Text>
            </View>

            <View style={{
              backgroundColor: moduleBackground,
              borderRadius: 15,
              padding: 12,
              alignItems: 'center',
              flex: 1,
              marginLeft: 5,
            }}>
              <Text style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: textColor,
              }}>
                {totalDrives !== null ? totalDrives : '...'}
              </Text>
              <Text style={{ fontSize: 14, color: altTextColor, marginTop: 4 }}>Drives</Text>
            </View>
          </View>

          
          
          <TouchableOpacity
            style={styles.aiButton}
            onPress={() => {
              fadeOutContent().then(() =>
                navigation.navigate('AIScreen')
              );
            }}
          >
            <LinearGradient
              colors={['#a300e4', '#2a00c0']} 
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.aiButtonImage, { borderRadius: 15 }]}
            >
              <BlurView intensity={5} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.buttonTextContainer}>
                <Text style={[styles.aiButtonText, { color: "#fff" }]}>✦ View Full Report</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { color: textColor, textAlign: 'left', }]}>
            Family Safety
          </Text>
          
          <TouchableOpacity
            style={styles.groupButton}
            onPress={() => {
              fadeOutContent().then(() =>
                navigation.navigate('LocationScreen')
              );
            }}
          >
            <LinearGradient
              colors={['#4bb2b9ff', '#2575fc']} 
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aiButtonImage}
            >
              <View style={styles.buttonTextContainer}>
                <Text style={[styles.groupButtonText, { color: "#fff" }]}>
                  My Group
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>


          <Snackbar
            visible={snackbarVisible}
            onDismiss={() => setSnackbarVisible(false)}
            duration={3000}
            style={{ backgroundColor: snackbarBackgroundColor, paddingHorizontal: 0, marginBottom: height/4, borderRadius: 20, outlineColor: snackbarColor, outlineWidth: 2, alignSelf: 'center' }}
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
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: '#fff', fontSize: 24 },
  background: { flex: 1 },
  buttonDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  overlay: {
    flex: 1,
    paddingHorizontal: width/15,
    paddingVertical: height/12,
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
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
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    fontFamily: "Arial Rounded MT Bold",
    color: "#fff",
    marginTop: 15,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: height/100,
  },
  headerContainer: {
    width: '70%',
    alignItems: 'flex-start', 
    marginBottom: 30, 
  },
  streakBox: {
    position: 'absolute', 
    top: 0,      
    right: 0,   
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  streakImage: {
    width: 28,
    height: 28,
    marginRight: 6,
  },

  streakText: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Arial Rounded MT Bold',
  },

  loginButtonInline: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  header: {
    fontSize: 32,
    fontWeight: '500',
    fontFamily: 'Arial Rounded MT Bold',
    alignSelf: 'flex-start',
  },
  subHeader: {
    fontSize: 16,
    marginTop: 4,  
  },

  greeting: {
    fontSize: 24, 
    fontWeight: 'bold',
    font: 'Arial Rounded MT Bold',
    marginBottom: 25,
    alignSelf: 'center'
  },
  safetyBox: {
    width: '100%',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: height / 50,
    height: 100
  },
  safetyButton: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  heatBarBox: {
    marginTop: 5,
    marginBottom: 15,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0)',
    position: 'relative',
    height: 65, 
  },
  heatBarContainer: {
    height: 50,
    position: 'relative', 
    justifyContent: 'center',
  },
  heatBarBackground: {
    height: 25,
    borderRadius: 20,
    width: '100%',
    position: 'absolute',
    top: 14,
  },
  markerScore: {
    alignItems: 'center',
    position: 'absolute',
    width: '100%',
    height: '100%',
    bottom: 12
  },
  heatBarMarker: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    top: 24,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 6,
  },
  heatBarScore: {
    position: 'absolute',
    fontWeight: 'bold',
    top: -4,
    fontSize: 22,
    color: '#fff',
    textAlign: 'center',
  },
  points: {
    fontSize: height/12,
    fontWeight: 'bold',
    maxWidth: '60%',
    textAlign: 'center',
    textShadowColor: '#00000079',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  pointsBox: {
    borderRadius: 15,
    overflow: 'hidden', 
    width: "100%", 
    height: height/8, 
    alignItems: 'center',
    justifyContent: 'center',
    padding: width/25,
    marginBottom: height/ 25
  },
  driveButton: {
    width: '100%',
    height: 70,
    borderRadius: 15,
    outlineColor: "#fff",
    outlineWidth: 1.5,
    overflow: 'hidden',
    marginBottom: height / 48,
  },
  aiButton: {
    width: '100%',
    height: 50,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: height / 48,
  },
  groupButton: {
    width: '100%',
    height: 50,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: height / 48,
    backgroundColor: "#4083ffff",
  },
  driveButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 0 },
  },
  aiButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  groupButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonImage: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
  },
  aiButtonImage: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
  },
  groupButtonImage: {
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
    borderRadius: 15,
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
