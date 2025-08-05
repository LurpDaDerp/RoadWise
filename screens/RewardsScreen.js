import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');
const BUTTON_WIDTH = (width - 65) / 2;
const BUTTON_HEIGHT = BUTTON_WIDTH;

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
    paddingTop: 80,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
  },
  points: {
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
    marginBottom: 36,
    textShadowColor: '#ffffff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  title: {
    paddingTop: 5,
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 24,
    color: 'white',
    marginBottom: 30,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    gap: 17,
  },
  button: {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'white',
    overflow: 'hidden',
    marginBottom: 0,
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
    borderRadius: 25,
  },

  buttonText: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    paddingHorizontal: 8,
  },
  imageOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0, 0, 0, 0.4)', 
  borderRadius: 16,
},
});
