import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';

export default function GamesRewardsScreen() {
  return (
      <ImageBackground
        source={require('../assets/comingsoon.jpg')}
        style={styles.background}
        resizeMode="cover"
      >
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
  
        <View style={styles.darkOverlay} />
  
        <View style={styles.container}>
          <Text style={styles.text}>Coming Soon...</Text>
        </View>
      </ImageBackground>
    );
  }
  
  const styles = StyleSheet.create({
    background: {
      flex: 1, 
    },
    darkOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.3)', 
    },
    container: { 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center' 
    },
    text: { 
      fontSize: 40, 
      color: '#fff', 
      fontWeight: 'bold',
      fontFamily: "Arial Rounded MT Bold"
    },
});