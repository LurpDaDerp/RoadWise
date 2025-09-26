import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../utils/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { saveUserPoints } from '../utils/firestore';
import { query, where, getDocs, collection } from 'firebase/firestore';

const { width, height } = Dimensions.get('window');

export default function SignUpScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); 

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.toLowerCase());
  };

  const handleSignUp = async () => {
    if (!username.trim()) {
      Alert.alert('Validation Error', 'Username cannot be empty.');
      return;
    }

    if (username.trim().length > 16) {
      Alert.alert('Username Too Long!', 'Username cannot be longer than 16 characters.');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }
    
    try {
      const q = query(
        collection(db, "users"),
        where("username", "==", username.trim().toLowerCase())
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        Alert.alert("Username Taken", "This username is already in use. Please choose another.");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await new Promise((resolve) => {
        const unsub = auth.onAuthStateChanged((currentUser) => {
          if (currentUser) {
            unsub();
            resolve();
          }
        });
      });

      await setDoc(doc(db, "users", uid), {
        username,
        points: 0,
        drivingStreak: 0,
        photoURL: null,
        groupId: null,
      });

      await setDoc(doc(db, "userinfo", uid), {
        email,
        createdAt: new Date(),
      });

      await saveUserPoints(uid, 0);
      await AsyncStorage.setItem('totalPoints', '0');

      navigation.reset({
        index: 0,
        routes: [{ name: 'Dashboard' }],
      });
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert('Account Exists', 'This account already exists. Please log in instead.');
      } else {
        Alert.alert('Sign Up Failed', error.message);
      }
    }
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <TextInput
        placeholder="Username"
        placeholderTextColor="#aaa"
        style={styles.input}
        value={username}
        onChangeText={setUsername}
      />
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
      <TouchableOpacity onPress={handleSignUp} style={styles.button}>
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
    paddingTop: height / (667 / 75),
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: height / (667 / 24),
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    color: '#fff',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#8c00ffff',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15
  },
});