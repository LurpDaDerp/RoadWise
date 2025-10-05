import React, { useState, useCallback, useRef, useContext } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
  Animated, 
  Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');
const getStorageKey = (uid) => `totalPoints_${uid}`;

export default function RewardsScreen({ route, navigation }) {
  const [totalPoints, setTotalPoints] = useState(0);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === 'dark';
  const gradientColors = isDark
    ? ['#43127cff', '#0f0f0fff'] 
    : ['#d1c4ff', '#f5f5f5']; 
  const titleColor = isDark ? '#fff' : '#000';
  const subtitleColor = isDark ? '#ddd' : '#444';
  const textShadowColor = isDark ? '#ffffff' : '#00000050';
  const borderColor = isDark ? '#fff' : '#00000085';
  const overlayColor = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
  const imageOverlayColor = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0, 0, 0, 0.19)';

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
      let isActive = true;
      (async () => {
        try {
          const stored = await AsyncStorage.getItem('totalPoints');
          if (isActive) setTotalPoints(stored ? parseFloat(stored) : 0);
        } catch (e) {
          console.error(e);
        }
      })();
      return () => { isActive = false; };
    }, [])
  );

  return (
    <LinearGradient
      colors={gradientColors}
      style={styles.background}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Animated.View style={[styles.fadeIn, { opacity: contentOpacity }]}>
        <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
          <Text style={[styles.title, { color: titleColor }]}>Rewards</Text>
          <Text style={[styles.subtitle, { color: subtitleColor }]}>
            Redeem points for prizes!
          </Text>

          <Text style={[styles.points, { color: titleColor, textShadowColor }]}>
            {totalPoints.toFixed(0)} Points
          </Text>

          <View style={styles.grid}>
            {[
              { label: 'Food & Drink', img: require('../assets/foodback.jpg'), route: 'FoodRewards' },
              { label: 'Shopping', img: require('../assets/shopback.jpg'), route: 'ShoppingRewards' },
              { label: 'Games & Entertainment', img: require('../assets/gameback.jpg'), route: 'GamesRewards' },
              { label: 'Subscriptions', img: require('../assets/subback.jpg'), route: 'SubscriptionsRewards' },
            ].map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.button, { borderColor }]}
                onPress={() => navigation.navigate(item.route)}
              >
                <ImageBackground
                  source={item.img}
                  style={styles.buttonBackground}
                  imageStyle={styles.buttonImage}
                >
                  <View style={[styles.imageOverlay, { backgroundColor: imageOverlayColor }]} />
                  <Text style={styles.buttonText}>{item.label}</Text>
                </ImageBackground>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: {
    flex: 1,
    paddingTop: height / (667 / 70),
    paddingHorizontal: width / (375 / 24),
    alignItems: 'center',
  },
  fadeIn: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 0,
    paddingBottom: 20,
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: 20,
    marginBottom: height / (667 / 12),
    textAlign: 'center',
  },
  points: {
    fontSize: width / (375 / 24),
    fontWeight: '600',
    marginBottom: height / (667 / 36),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: width / (375 / 10),
  },
  grid: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    width: width * 0.9,
    height: height / (667 / 75),
    borderRadius: width / (375 / 18),
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: height / (667 / 10),
  },
  buttonBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  buttonImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: width / (375 / 15),
  },
  buttonText: {
    fontSize: width / (375 / 18),
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: width / (375 / 2),
    paddingHorizontal: width / (375 / 8),
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: width / (375 / 16),
  },
});
