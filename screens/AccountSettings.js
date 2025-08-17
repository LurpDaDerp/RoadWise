import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Dimensions,
} from 'react-native';
import { auth, db } from '../utils/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserPoints, saveUserPoints } from '../utils/firestore';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { query, where, getDocs, collection } from 'firebase/firestore';

const { width, height } = Dimensions.get('window');

export default function AccountSettings(route) {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState(null);
  const [editedUsername, setEditedUsername] = useState('');
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const rootNav = route.params?.rootNavigation;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const uid = currentUser.uid;

        try {
          const userPoints = await getUserPoints(uid);
          setPoints(userPoints);

          const userDocRef = doc(db, 'users', uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setUsername(userDocSnap.data().username || 'N/A');
          } else {
            setUsername('N/A');
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
          setPoints(0);
          setUsername('N/A');
        }
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        const stored = await AsyncStorage.getItem('totalPoints');
        const totalPoints = stored ? parseFloat(stored) : 0;
        await saveUserPoints(uid, totalPoints);
      }

      await signOut(auth);
      rootNav?.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error) {
      Alert.alert('Sign Out Failed', error.message);
    }
  };

  const handleSwitchAccount = async () => {
    try {
      await signOut(auth);
      rootNav?.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error) {
      Alert.alert('Switch Failed', error.message);
    }
  };

  const startEditing = () => {
    setEditedUsername(username === 'N/A' ? '' : username);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedUsername('');
  };

  const saveUsername = async () => {
    if (!editedUsername.trim()) {
      Alert.alert('Validation Error', 'Username cannot be empty.');
      return;
    }

    setSaving(true);

    try {
      const trimmed = editedUsername.trim();
      const uid = user.uid;

      const q = query(collection(db, 'users'), where('username', '==', trimmed));
      const querySnapshot = await getDocs(q);

      const takenBySomeoneElse = querySnapshot.docs.some(doc => doc.id !== uid);
      if (takenBySomeoneElse) {
        Alert.alert('Username Taken', 'This username is already in use by another user.');
        setSaving(false);
        return;
      }

      const userDocRef = doc(db, 'users', uid);
      await setDoc(userDocRef, { username: trimmed }, { merge: true });
      setUsername(trimmed);
      setIsEditing(false);
      setEditedUsername('');
      Alert.alert('Success', 'Username updated!');
    } catch (error) {
      Alert.alert('Update Failed', error.message);
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="medium" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account Settings</Text>

      {user ? (
        <>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>

          <View style={styles.infoBox}>
            <View style={styles.usernameRow}>
              <Text style={styles.infoLabel}>Username</Text>
              {!isEditing && (
                <TouchableOpacity onPress={startEditing}>
                  <Ionicons name="pencil" size={20} color="#3498db" />
                </TouchableOpacity>
              )}
            </View>

            {isEditing ? (
              <>
                <TextInput
                  style={[styles.infoValue, styles.input]}
                  value={editedUsername}
                  onChangeText={setEditedUsername}
                  editable={!saving}
                  autoFocus
                  maxLength={30}
                  placeholder="Enter username"
                  placeholderTextColor="#888"
                />
                <View style={styles.editButtonsRow}>
                  <TouchableOpacity
                    style={[styles.editButton, styles.cancelButton]}
                    onPress={cancelEditing}
                    disabled={saving}
                  >
                    <Text style={styles.editButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editButton, styles.saveButton]}
                    onPress={saveUsername}
                    disabled={saving}
                  >
                    <Text style={styles.editButtonText}>
                      {saving ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={styles.infoValue}>{username ?? 'N/A'}</Text>
            )}
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Total Points</Text>
            <Text style={styles.infoValue}>{points ?? 0}</Text>
          </View>

          <TouchableOpacity style={styles.switchButton} onPress={handleSwitchAccount}>
            <Text style={styles.switchButtonText}>Switch Account</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => rootNav?.reset({ index: 0, routes: [{ name: 'Login' }] })}
        >
          <Text style={styles.loginButtonText}>Log In</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: width / (375 / 24),
    backgroundColor: '#111',
    justifyContent: 'top',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: height / (667 / 60),
    marginBottom: height / (667 / 32),
    alignSelf: 'center',
  },
  infoBox: {
    marginBottom: height / (667 / 20),
    backgroundColor: '#222',
    padding: width / (375 / 16),
    borderRadius: width / (375 / 8),
  },
  infoLabel: {
    color: '#bbb',
    fontSize: 14,
    marginBottom: height / (667 / 4),
  },
  infoValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  usernameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    backgroundColor: '#333',
    color: '#fff',
    borderRadius: width / (375 / 6),
    paddingHorizontal: width / (375 / 8),
    paddingVertical: height / (667 / 6),
    fontSize: 18,
  },
  editButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: height / (667 / 8),
    columnGap: width / (375 / 12),
  },
  editButton: {
    paddingVertical: height / (667 / 8),
    paddingHorizontal: width / (375 / 16),
    borderRadius: width / (375 / 6),
  },
  cancelButton: {
    backgroundColor: '#555',
  },
  saveButton: {
    backgroundColor: '#3498db',
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  switchButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: width / (375 / 8),
    alignItems: 'center',
    marginBottom: height / (667 / 16),
  },
  switchButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  signOutButton: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: width / (375 / 8),
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  loginButton: {
    backgroundColor: '#00b894',
    padding: 15,
    borderRadius: width / (375 / 8),
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
