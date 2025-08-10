import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

const { width, height } = Dimensions.get('window');
const BUTTON_WIDTH = width * 2/5;


export default function RewardsScreen({ route, navigation }) {
  const totalPoints = route.params?.totalPoints ?? 0;

  return (
    <ImageBackground
      source={require('../assets/rewardsback.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>

        <Text style={styles.title}>Rewards</Text>
        <Text style={styles.subtitle}>Redeem points for prizes!</Text>

        <Text style={styles.points}>{totalPoints.toFixed(0)} Points</Text>

        <View style={styles.grid}>
          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('RewardsSubpages', { screen: 'FoodRewards' })}>
            <ImageBackground
              source={require('../assets/foodback.jpg')}
              style={styles.buttonBackground}
              imageStyle={styles.buttonImage}
            >
              <View style={styles.imageOverlay} />
              <Text style={styles.buttonText}>Food & Drink</Text>
            </ImageBackground>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('RewardsSubpages', { screen: 'ShoppingRewards' })}>
            <ImageBackground
              source={require('../assets/shopback.jpg')}
              style={styles.buttonBackground}
              imageStyle={styles.buttonImage}
            >
              <View style={styles.imageOverlay} />
              <Text style={styles.buttonText}>Shopping</Text>
            </ImageBackground>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('RewardsSubpages', { screen: 'GamesRewards' })}>
            <ImageBackground
              source={require('../assets/gameback.jpg')}
              style={styles.buttonBackground}
              imageStyle={styles.buttonImage}
            >
              <View style={styles.imageOverlay} />
              <Text style={styles.buttonText}>Games & Entertainment</Text>
            </ImageBackground>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('RewardsSubpages', { screen: 'SubscriptionsRewards' })}>
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    paddingTop: height / (667 / 80),
    paddingHorizontal: width / (375 / 24),
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    fontSize: width / (375 / 44),
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 0,
    paddingBottom: height / (667 / 8),
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: width / (375 / 24),
    color: 'white',
    marginBottom: height / (667 / 30),
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
