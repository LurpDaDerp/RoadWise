import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function AboutScreen({ imageUri }) {
  const navigation = useNavigation();

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

          {/* <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Drive')}>
            <Text style={styles.ctaText}>Start driving safely</Text>
          </TouchableOpacity> */}
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.openDrawer()}>
            <Ionicons name="menu" size={32} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
  },
  imageBg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  imageStyle: {
    opacity: 0.9,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  menuButton: {
    position: 'absolute',
    top: height / (667 / 50),
    left: width / (375 / 20),
  },
  contentContainer: {
    paddingTop:
      Platform.OS === 'android'
        ? StatusBar.currentHeight + height / (667 / 24)
        : height / (667 / 48),
    paddingHorizontal: width / (375 / 24),
    paddingBottom: height / (667 / 48),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'center',
    marginBottom: height / (667 / 20),
  },
  title: {
    color: '#fff',
    fontSize: width / (375 / 28),
    fontWeight: '700',
    alignSelf: 'center',
  },
  closeButton: {
    paddingHorizontal: width / (375 / 10),
    paddingVertical: height / (667 / 6),
  },
  closeText: {
    color: '#fff',
    fontSize: width / (375 / 14),
  },
  lead: {
    color: '#f5f5f5',
    fontSize: width / (375 / 16),
    lineHeight: height / (667 / 22),
    marginBottom: height / (667 / 18),
  },
  statsCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: width / (375 / 12),
    padding: width / (375 / 16),
    marginBottom: height / (667 / 18),
  },
  statsTitle: {
    color: '#fff',
    fontSize: width / (375 / 18),
    fontWeight: '700',
    marginBottom: height / (667 / 8),
  },
  statLine: {
    color: '#e6e6e6',
    fontSize: width / (375 / 14),
    lineHeight: height / (667 / 20),
    marginBottom: height / (667 / 6),
  },
  statBold: {
    color: '#fff',
    fontWeight: '700',
  },
  personal: {
    color: '#e9e9e9',
    fontSize: width / (375 / 15),
    lineHeight: height / (667 / 22),
    marginBottom: height / (667 / 20),
  },
  cta: {
    backgroundColor: '#1f8ef1',
    alignSelf: 'stretch',
    paddingVertical: height / (667 / 14),
    borderRadius: width / (375 / 12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: height / (667 / 18),
  },
  ctaText: {
    color: '#fff',
    fontSize: width / (375 / 16),
    fontWeight: '700',
  },
});
