import React, { useState, useCallback, useRef } from 'react';
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

const { width, height } = Dimensions.get('window');

const getStorageKey = (uid) => `totalPoints_${uid}`

export default function RewardsScreen({ route, navigation }) {
  const [totalPoints, setTotalPoints] = useState(0);
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
      colors={['#43127cff', '#0f0f0fff']} 
      style={styles.background}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Animated.View style={[styles.fadeIn, { opacity: contentOpacity }]}>
      <View style={styles.overlay}>

        <Text style={styles.title}>Rewards</Text>
        <Text style={styles.subtitle}>Redeem points for prizes!</Text>


        <Text style={styles.points}>{totalPoints.toFixed(0)} Points</Text>

        <View style={styles.grid}>
          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('FoodRewards')}>
            <ImageBackground
              source={require('../assets/foodback.jpg')}
              style={styles.buttonBackground}
              imageStyle={styles.buttonImage}
            >
              <View style={styles.imageOverlay} />
              <Text style={styles.buttonText}>Food & Drink</Text>
            </ImageBackground>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('ShoppingRewards')}>
            <ImageBackground
              source={require('../assets/shopback.jpg')}
              style={styles.buttonBackground}
              imageStyle={styles.buttonImage}
            >
              <View style={styles.imageOverlay} />
              <Text style={styles.buttonText}>Shopping</Text>
            </ImageBackground>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('GamesRewards')}>
            <ImageBackground
              source={require('../assets/gameback.jpg')}
              style={styles.buttonBackground}
              imageStyle={styles.buttonImage}
            >
              <View style={styles.imageOverlay} />
              <Text style={styles.buttonText}>Games & Entertainment</Text>
            </ImageBackground>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('SubscriptionsRewards' )}>
            <ImageBackground
              source={require('../assets/subback.jpg')}
              style={styles.buttonBackground}
              imageStyle={styles.buttonImage}
            >
              <View style={styles.imageOverlay} />
              <Text style={styles.buttonText}>Subscriptions</Text>
            </ImageBackground>
          </TouchableOpacity>

        </View>
      </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    paddingTop: height / (667 / 70),
    paddingHorizontal: width / (375 / 24),
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
  },
  fadeIn: {
    flex: 1,
    alignItems: 'center',
  },
  points: {
    fontSize: width / (375 / 24),
    fontWeight: '600',
    color: 'white',
    marginBottom: height / (667 / 36),
    textShadowColor: '#ffffff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: width / (375 / 10),
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 0,
    paddingBottom: 20,
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: 20,
    color: 'white',
    marginBottom: height / (667 / 12),
    textAlign: 'center',
  },
  grid: {
    width: '100%',
    alignItems: 'center', 
  },
  button: {
    width: width * 0.9, 
    height: height / (667 / 75), 
    borderRadius: width / (375 / 15),
    borderWidth: 1,
    borderColor: 'white',
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
    borderRadius: width / (375 / 25),
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: width / (375 / 16),
  },
});
