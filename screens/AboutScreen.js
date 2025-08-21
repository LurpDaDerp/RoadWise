import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Dimensions,
  ScrollView,
  StatusBar,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

export default function AboutScreen({ imageUri }) {
  const navigation = useNavigation();
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const bgSource = imageUri
    ? { uri: imageUri }
    : require('../assets/aboutback.jpg');

  const STATS = {
    year: 2023,
    distractedDriverDeaths: 3275,
    phoneInvolvedPercent: 12,
    textingCrashMultiplier: 23,
    dailyPhoneDeathSummary: 'Nearly one life is lost every single day in the U.S. due to phone-related distractions',
  };

  const fadeInContent = useCallback(() => {
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.poly(3)),
      useNativeDriver: true,
    }).start();
  }, [contentOpacity]);

  useFocusEffect(
    useCallback(() => {
      contentOpacity.setValue(0);
      fadeInContent();
    }, [fadeInContent])
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ImageBackground
        source={bgSource}
        style={styles.imageBg}
        imageStyle={styles.imageStyle}
        resizeMode="cover"
      >
        <View style={styles.overlay} pointerEvents="none" />

        <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
          <ScrollView contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>About</Text>
            </View>

            <Text style={styles.lead}>
              I created this app because I’ve seen firsthand how quickly a phone can turn a normal drive into a tragedy. 
              A quick glance doesn’t feel like much, but it’s often enough to take your eyes off the road for several seconds. 
              At highway speeds that can mean driving the length of a football field blind.
            </Text>

            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>The facts</Text>
              <Text style={styles.statLine}>
                • Each year, over <Text style={styles.statBold}>3,000</Text> people lose their lives in distracted driving accidents in the United States.
              </Text>
              <Text style={styles.statLine}>
                • An estimated <Text style={styles.statBold}>{STATS.phoneInvolvedPercent}%</Text> of those fatal crashes involved phone use.
              </Text>
              <Text style={styles.statLine}>
                • Phone use while driving makes a crash <Text style={styles.statBold}>{STATS.textingCrashMultiplier}×</Text> more likely.
              </Text>
              <Text style={styles.statLine}>{'• ' + STATS.dailyPhoneDeathSummary}.</Text>
            </View>

            <Text style={styles.personal}>
              This isn’t just about numbers. It’s about people. Families who never got to say goodbye, friends who never made it home. 
              I built this app to help drivers stay focused and remove the small but deadly temptations of their phones. 
              This is becoming increasingly important in a digitalized world, where our phones are becoming bigger parts of daily life, 
              making it harder, and more vital, to stay focused on the road.
              If this app helps prevent even one crash, it will have been worth the work.
            </Text>
          </ScrollView>
        </Animated.View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0b' },
  imageBg: { flex: 1, width: '100%', height: '100%' },
  imageStyle: { opacity: 0.9 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  contentContainer: {
    paddingTop:
      Platform.OS === 'android'
        ? StatusBar.currentHeight + height / (667 / 24)
        : height / (667 / 48),
    paddingHorizontal: width / (375 / 24),
    paddingBottom: height / (667 / 48),
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'left', marginBottom: height / (667 / 20) },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', alignSelf: 'left' },
  lead: { color: '#f5f5f5', fontSize: 16, lineHeight: 22, marginBottom: 18 },
  statsCard: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: width / (375 / 12), padding: width / (375 / 16), marginBottom: height / (667 / 18) },
  statsTitle: { color: '#fff', fontSize:18, fontWeight: '700', marginBottom: height / (667 / 8) },
  statLine: { color: '#e6e6e6', fontSize: 14, lineHeight: 20, marginBottom: height / (667 / 6) },
  statBold: { color: '#fff', fontWeight: '700' },
  personal: { color: '#e9e9e9', fontSize: 16, lineHeight: 22, marginBottom: height / (667 / 20) },
});
