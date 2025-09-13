import React, { useEffect, useState, useRef, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity, 
  ScrollView, 
  Image, 
  Animated, 
  Easing
} from 'react-native';
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { auth } from '../utils/firebase';
import { db } from '../utils/firebase';
import { ImageBackground } from 'expo-image';
import Svg, { Text as SvgText, TextPath, Defs, Path } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';


const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const scale = screenWidth / 375;
const usersShown = 50;

const { width, height } = Dimensions.get('window');


function CurvedRibbonTitle() {
  return (
    <Svg
      width={width * 1.3}
      height={height/7}
      viewBox="0 0 300 100"
      style={{ alignSelf: 'center' }} 
    >
      <Defs>
        <Path
          id="curve"
          d="M10,80 Q150,50 290,80"  
          fill="transparent"
        />
      </Defs>
      <SvgText
        fill="white"
        fontSize= {width/15}
        fontWeight="bold"
        fontFamily= "futura"
        textAnchor="middle"  
        transform={`translate(0, 5)`}
      >
        <TextPath href="#curve" startOffset="50%" style={styles.ribbonTitle}>
          Leaderboard
        </TextPath>
      </SvgText>
    </Svg>
  );
}

export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserPlacement, setCurrentUserPlacement] = useState(null);
  const [loading, setLoading] = useState(true);

  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === "dark";

  const backgroundColor = isDark ? "#070707cc" : "#ffffffcc";
  const bottomSheetBackground = isDark ? "#131313ff" : "#ffffff"; 
  const moduleBackground = isDark ? '#2c2c2cff' : '#ddddddff';
  const titleColor = isDark ? "#fff" : "#000";
  const textColor = isDark ? "#fff" : "#000";
  const altTextColor = isDark ? '#aaa' : '#555';
  const buttonColor = isDark ? `rgba(92, 179, 238, 1)` : `rgba(69, 146, 235, 1)`;
  const sheetGradientTop = isDark ? "#131313ff" : "#ffffffff"; 
  const sheetGradientBottom = isDark ? "#131313ff" : "#ffffffff"; 

  const contentOpacity = useRef(new Animated.Value(0)).current;

  const fadeInContent = useCallback(() => {
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.poly(3)),
      useNativeDriver: true,
    }).start();
  }, [contentOpacity]);

  useFocusEffect(
    useCallback(() => {
      contentOpacity.setValue(0);
      fadeInContent();
    }, [])
  );

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const currentUser = auth.currentUser;
        const currentUid = currentUser?.uid || null;
        setCurrentUserId(currentUid);

        const leaderboardRef = collection(db, 'users');
        const leaderboardQuery = query(
          leaderboardRef,
          orderBy('points', 'desc'),
          limit(usersShown)
        );
        const querySnapshot = await getDocs(leaderboardQuery);

        const topResults = [];
        let isCurrentUserInTop10 = false;

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const id = doc.id;

          const user = {
            id,
            name: data.username || 'N/A',
            points: data.points || 0,
          };

          if (id === currentUid) isCurrentUserInTop10 = true;

          topResults.push(user);
        });

        setLeaderboard(topResults);

        if (!isCurrentUserInTop10 && currentUid) {
          const allSnapshot = await getDocs(
            query(leaderboardRef, orderBy('points', 'desc'))
          );

          let rank = 1;
          for (const doc of allSnapshot.docs) {
            if (doc.id === currentUid) {
              const data = doc.data();
              setCurrentUserPlacement({
                id: doc.id,
                name: data.username || 'You',
                points: data.points || 0,
                rank,
              });
              break;
            }
            rank++;
          }
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  
  const navigation = useNavigation();

  return (
    
    <LinearGradient
      colors={[sheetGradientTop, sheetGradientBottom]}
      style={styles.background}
    >
      <Animated.View style={[styles.fadeIn, { opacity: contentOpacity }]}>
      <View style={styles.overlay}>
        <View style={styles.ribbonContainer}>
          <Image
            source={require('../assets/ribbon.png')}
            style={styles.ribbonImage}
            resizeMode="contain"
          />
          <View style={styles.curvedTextOverlay}>
            <CurvedRibbonTitle/>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ScrollView style={styles.leaderboardContainer}>
            {Array.from({ length: usersShown }, (_, index) => {
              const user = leaderboard[index];
              const isCurrentUser = user?.id === currentUserId;

              const crownImages = [
                require('../assets/crown1.png'),
                require('../assets/crown2.png'),
                require('../assets/crown3.png')
              ];
              const crownImage = index < 3 ? crownImages[index] : null;

              return (
                <View
                  key={index}
                  style={[styles.row, isCurrentUser && styles.currentUserRow]}
                >
                  <View style={{ width: width/50, alignItems: 'center' }}>
                    {crownImage && (
                      <Image
                        source={crownImage}
                        style={{ width: width/15, height: width/15 }}
                        resizeMode="contain"
                      />
                    )}
                  </View>

                  <View style={{ width: width/10, alignItems: 'flex-end', paddingRight: 5 }}>
                    <Text style={[styles.name, {color: textColor}, isCurrentUser && styles.currentUserText]}>
                      {index + 1}.
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, {color: textColor}, isCurrentUser && styles.currentUserText]}>
                      {user ? user.name : 'N/A'}
                    </Text>
                  </View>

                  <View style={{ minWidth: width/8, alignItems: 'flex-end' }}>
                    <Text style={[styles.points, {color: textColor}, isCurrentUser && styles.currentUserText]}>
                      {user ? user.points : ''}
                    </Text>
                  </View>
                </View>
              );
            })}

            {currentUserPlacement && (
              <>
                <View style={{ height: 20 * scale }} />
                <View style={[styles.row, styles.currentUserRow]}>
                  <Text style={[styles.name, styles.currentUserText]}>
                    {currentUserPlacement.rank}. {currentUserPlacement.name + " (You)"}
                  </Text>
                  <Text style={[styles.points, styles.currentUserText]}>
                    {currentUserPlacement.points}
                  </Text>
                </View>
              </>
            )}

            <Text>
              
            </Text>

          </ScrollView>
        )}
      </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: {
    flex: 1,
    padding: width/25,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    overflow: 'visible',
  },
  fadeIn: {
    flex: 1,
    overflow: 'visible',
  },
  ribbonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: height/-7.5, 
    marginBottom: height/-7.5,
    position: 'relative',
    zIndex: 20, 
    pointerEvents: 'none', 
  },
  ribbonImage: {
    marginTop: height/9,
    width: width*2.5/2,
    height: height/3.3,
  },
  curvedTextOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 10,
  },
  leaderboardContainer: {
    backgroundColor: 'rgba(117, 117, 117, 0.1)',  
    borderColor: 'rgba(255, 255, 255, 0)',  
    borderWidth: 2,
    borderRadius: width/20,
    paddingTop: height/12,
    marginTop: height/-35,
    overflow: 'hidden', 
    zIndex: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingRight: width/20,
    paddingLeft: width/20,
    borderBottomWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: '90%', 
    alignSelf: "center"
  },
  name: {
    fontSize: 18,
  },
  points: {
    fontSize: 18,
    fontFamily: 'Arial Rounded MT Bold',
  },
  currentUserRow: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderColor: '#00da12ff',
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: width/15,
  },
  currentUserText: {
    color: '#00ff15ff',
  },
});
