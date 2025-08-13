//LoginScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Dimensions,
} from 'react-native';
import { auth } from '../utils/firebase';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import { useNavigation } from '@react-navigation/native';
import { ensureUserStreakFields } from '../utils/firestoreHelpers';

const { width, height } = Dimensions.get('window');


export default function LoginScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Initialize Google Auth Request
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: '1048529675719-q78r5e76ulmhm7a4c779lk8711ir88cdapps.googleusercontent.com',
  });

  // Handle Google Sign-In response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .then(async (userCred) => {
          await ensureUserStreakFields(userCred.user.uid);
          navigation.navigate('Dashboard');
        })
        .catch((error) => {
          Alert.alert('Google Sign-In Failed', error.message);
        });
    }
  }, [response]);

  const handleLogin = async () => {
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserStreakFields(userCred.user.uid);
      navigation.navigate('Dashboard');
    } catch (error) {
      Alert.alert('Incorrect email or password');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RoadCash Login</Text>
      <Text style={styles.subtitle}>Log in to access all features and redeem rewards!</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#aaa"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor="#aaa"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity onPress={handleLogin} style={styles.button}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>

      {/* Google Sign-In button */}
      <TouchableOpacity
        disabled={!request}
        onPress={() => promptAsync()}
        style={[styles.button, { backgroundColor: '#4285F4', marginTop: 12 }]}
      >
        <Text style={styles.buttonText}>Sign In with Google</Text>
      </TouchableOpacity>

      {/* Navigate to Sign Up */}
      <TouchableOpacity
        onPress={() => navigation.navigate('SignUp')}
        style={[styles.button, { backgroundColor: '#444', marginTop: 12 }]}
      >
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'top',
    padding: width / (375 / 24),
  },
  title: {
    fontSize: width / (375 / 32),
    fontWeight: 'bold',
    color: '#fff',
    marginTop: height / (667 / 60),
    marginBottom: height / (667 / 32),
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: width / (375 / 16),
    color: '#fff',
    marginBottom: height / (667 / 24),
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#222',
    padding: width / (375 / 12),
    borderRadius: width / (375 / 8),
    color: '#fff',
    marginBottom: height / (667 / 16),
  },
  button: {
    backgroundColor: '#00b894',
    padding: 15,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
