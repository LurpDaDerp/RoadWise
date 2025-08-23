import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import * as ImagePicker from "expo-image-picker";
import { auth, db} from '../utils/firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserPoints, saveUserPoints } from '../utils/firestore';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { query, where, getDocs, collection } from 'firebase/firestore';
import { ThemeContext } from '@react-navigation/native';
import { supabase } from '../utils/supabase';
import { tabNavRef } from '../App';

const { width, height } = Dimensions.get('window');

export default function AccountSettings(route) {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState(null);
  const [editedUsername, setEditedUsername] = useState('');
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingImage, setLoadingImage] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoURL, setPhotoURL] = useState(null);
  const [groupName, setGroupName] = useState('None');

  const rootNav = route.params?.rootNavigation;

  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === 'dark';
  
  const backgroundColor = isDark ? '#161616ff' : '#fff';
  const titleColor = isDark ? '#fff' : '#000';
  const textColor = isDark ? '#fff' : '#000';
  const moduleBackground = isDark ? '#333' : '#ebebebff';
  const altTextColor = isDark ? '#aaa' : '#555';
  const textOutline = isDark? 'rgba(255, 255, 255, 0.47)' : '#0000008e';
  const buttonColor = isDark ? `rgba(108, 55, 255, 1)` : `rgba(99, 71, 255, 1)`;
  const snackbarBackgroundColor = isDark ? '#222' : '#fff';
  const snackbarTextColor = isDark ? '#fff' : '#555';

  // Load user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const uid = currentUser.uid;

        const cachedImage = await AsyncStorage.getItem('cachedProfileImage');
        if (cachedImage) setPhotoURL(cachedImage);

        try {
          const userPoints = await getUserPoints(uid);
          setPoints(userPoints);

          const userDocRef = doc(db, 'users', uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUsername(data.username || 'N/A');
            setPhotoURL(data.photoURL || null);

            if (data.groupId) {
              const groupDocRef = doc(db, 'groups', data.groupId);
              const groupDocSnap = await getDoc(groupDocRef);
              if (groupDocSnap.exists()) {
                setGroupName(groupDocSnap.data().groupName || 'Unknown');
              } else {
                setGroupName('Unknown');
              }
            } else {
              setGroupName('None');
            }
          }

        } catch (err) {
          console.error(err);
          setPoints(0);
          setUsername('N/A');
          setGroupName('None');
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);


  // Pick profile image
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], 
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      setLoadingImage(true);

      if (!result.canceled && result.assets.length > 0) {
        const uri = result.assets[0].uri;

        const uid = user.uid;
        const filename = `${uid}/profilePic.jpg`;

        const response = await fetch(uri);
        const buffer = await response.arrayBuffer();

        await supabase.storage
          .from('profile-pictures')
          .remove([filename]);

        const { data, error } = await supabase.storage
          .from('profile-pictures')
          .upload(filename, buffer, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/jpeg',
          });

        if (error) throw error;

        const { data: urlData, error: urlError } = supabase.storage
          .from('profile-pictures')
          .getPublicUrl(filename);

        if (urlError) throw urlError;

        const publicURL = urlData.publicUrl + "?t=" + new Date().getTime();
        setPhotoURL(publicURL);

        await AsyncStorage.setItem('cachedProfileImage', publicURL);

        const userDocRef = doc(db, "users", uid);
        await setDoc(userDocRef, { photoURL: publicURL }, { merge: true });
      }
    } catch (error) {
      Alert.alert("Upload Failed", error.message);
    } finally {
      setLoadingImage(false);
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Account Settings</Text>
      {/* Profile Picture */}
      <View style={styles.profileBox}>
        <TouchableOpacity onPress={pickImage}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.profileImage} />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitial}>
                {username ? username[0].toUpperCase() : '?'}
              </Text>
            </View>
          )}
          {loadingImage && (
            <View style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(0,0,0,0.4)',
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 50
            }}>
              <ActivityIndicator size="medium" color="#fff" />
            </View>
          )}
        </TouchableOpacity>
        <Text style={[styles.infoLabel, {marginTop: 10, marginBottom: 0}]}>Tap to edit</Text>
      </View>

      {/* Username */}
      <View style={styles.infoBox}>
        <View style={styles.usernameRow}>
          <Text style={styles.infoLabel}>Username</Text>
          {!isEditing && (
            <TouchableOpacity onPress={() => {
              setEditedUsername(username === 'N/A' ? '' : username);
              setIsEditing(true);
            }}>
              <MaterialIcons name="edit" size={20} color="#afafafff" />
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
                onPress={() => setIsEditing(false)}
                disabled={saving}
              >
                <Text style={styles.editButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, styles.saveButton]}
                onPress={async () => {
                  if (!editedUsername.trim()) {
                    Alert.alert('Validation Error', 'Username cannot be empty.');
                    return;
                  }
                  setSaving(true);
                  try {
                    const uid = user.uid;
                    const trimmed = editedUsername.trim();
                    const q = query(collection(db, 'users'), where('username', '==', trimmed));
                    const querySnapshot = await getDocs(q);
                    const taken = querySnapshot.docs.some(doc => doc.id !== uid);
                    if (taken) {
                      Alert.alert('Username Taken', 'This username is already in use.');
                      setSaving(false);
                      return;
                    }
                    const userDocRef = doc(db, 'users', uid);
                    await setDoc(userDocRef, { username: trimmed }, { merge: true });
                    setUsername(trimmed);
                    setIsEditing(false);
                  } catch (error) {
                    Alert.alert('Update Failed', error.message);
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                <Text style={styles.editButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={styles.infoValue}>{username ?? 'N/A'}</Text>
        )}
      </View>

      {/* Email */}
      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>Email</Text>
        <Text style={styles.infoValue}>{user?.email ?? 'Not logged in'}</Text>
      </View>

      {/* Current Group */}
      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>Current Group</Text>
        <Text style={styles.infoValue}>{groupName}</Text>
      </View>

      {/* Total Points */}
      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>Total Points</Text>
        <Text style={styles.infoValue}>{points ?? 0}</Text>
      </View>

      {/* some buttons */}
      <TouchableOpacity style={styles.switchButton} onPress={async () => {
        await signOut(auth);

        if (navigation) {
          navigation.navigate('Dashboard');
        }
      }}>
        <Text style={styles.switchButtonText}>Switch Account</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} onPress={async () => {
        const uid = user.uid;
        if (uid) {
          const stored = await AsyncStorage.getItem('totalPoints');
          const totalPoints = stored ? parseFloat(stored) : 0;
          await saveUserPoints(uid, totalPoints);
        }
        await signOut(auth);

        if (navigation) {
          navigation.navigate('Dashboard');
        }
      }}>
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: width / (375 / 16) },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginTop: height/10, marginBottom: height/25, alignSelf: 'center' },
  profileBox: { alignItems: 'center', marginBottom: 20 },
  profileImage: { width: 100, height: 100, borderRadius: 50 },
  profilePlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#2c99ffff', justifyContent: 'center', alignItems: 'center' },
  profileInitial: { fontSize: 36, color: '#fff', fontWeight: 'bold' },
  infoBox: { marginBottom: 10, backgroundColor: '#222', padding: 16, borderRadius: 15 },
  infoLabel: { color: '#bbb', fontSize: 12, marginBottom: 5},
  infoValue: { color: '#fff', fontSize: 16, fontWeight: '600' },
  usernameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { backgroundColor: '#333', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 18 },
  editButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, columnGap: 8 },
  editButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  cancelButton: { backgroundColor: '#555' },
  saveButton: { backgroundColor: '#413effff' },
  editButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  switchButton: { backgroundColor: '#3b90ffff', padding: 15, borderRadius: 15, alignItems: 'center', marginBottom: 10 },
  switchButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  signOutButton: { backgroundColor: '#ff4631ff', padding: 15, borderRadius: 15, alignItems: 'center' },
  signOutButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
