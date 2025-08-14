import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function AIScreen({ navigation }) {
  const handlePress = () => {
    console.log('Button pressed!');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Welcome!</Text>

      <TouchableOpacity style={styles.button} onPress={handlePress}>
        <ImageBackground
          source={require('../assets/AIbutton.jpg')} 
          style={styles.buttonImage}
          imageStyle={{ borderRadius: width / 18 }}
          resizeMode="cover"
        >
          <View style={styles.overlay} />

          <View style={styles.textContainer}>
            <Text style={styles.buttonText}>AI Coach</Text>
          </View>
        </ImageBackground>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 40,
  },
  button: {
    width: '100%',
    height: 75,
    borderRadius: width / 18,
    overflow: 'hidden',
    marginBottom: 20,
  },
  buttonImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)', // darkens the image
    borderRadius: width / 18,
  },
  textContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
