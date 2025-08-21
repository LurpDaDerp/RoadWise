import React, { useState, useCallback, useContext, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
  ImageBackground,
  Animated,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';

import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { saveUserDrive, getUserDrives, clearUserDrives } from '../utils/firestore';
import { getAuth } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';

const firestore = getFirestore();

const { width, height } = Dimensions.get('window');

function interpolateColor(percent) {
  const p = Math.min(Math.max(percent, 0), 75) / 75;

  const start = { r: 12, g: 250, b: 0 };
  const end = { r: 250, g: 0, b: 0 };

  const r = Math.round(start.r + (end.r - start.r) * p);
  const g = Math.round(start.g + (end.g - start.g) * p);
  const b = Math.round(start.b + (end.b - start.b) * p);

  return `rgb(${r},${g},${b})`;
}

export default function MyDrivesScreen() {
  const [drives, setDrives] = useState([]);
  const navigation = useNavigation();
  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === 'dark';

  const LOAD_BATCH = 10; 
  const [visibleCount, setVisibleCount] = useState(LOAD_BATCH);

  const itemBackground = isDark ? '#222' : '#fff';
  const dateColor = isDark ? '#fff' : '#000';
  const detailColor = isDark ? '#aaa' : '#555';
  const distractedColor = '#cc0000';
  const focusedColor = isDark ? 'lightgreen' : 'green';
  const closeButtonColor = isDark? '#5e5e5eff' : '#929292ff';

  const customFadeAnim = useRef(new Animated.Value(0)).current;
  
  const [loading, setLoading] = useState(true);

  const loadDrives = async () => {
    const user = getAuth().currentUser;
    const uid = user.uid;
    if (!user) return setDrives([]);
    const fetched = await getUserDrives(uid);
    setDrives(fetched);
    setVisibleCount(LOAD_BATCH);
  };

  const distractedCount = drives.filter(d => d.distracted).length;
  const undistractedCount = drives.length - distractedCount;
  const percentDistracted =
    drives.length > 0
      ? Math.round((distractedCount / drives.length) * 10000) / 100
      : null;
  const percentColor = percentDistracted !== null 
    ? interpolateColor(percentDistracted) 
    : '#888'; 

  useFocusEffect(
    useCallback(() => {
      loadDrives();
      setLoading(false);
    }, [])
  );

  const clearDriveHistory = async () => {
    Alert.alert(
      'Clear Drive History',
      'Are you sure you want to clear all drive history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const user = getAuth().currentUser;
              if (!user) {
                console.warn('No user logged in, cannot clear drives.');
                return;
              }
              await clearUserDrives(user.uid);
              setDrives([]);
            } catch (e) {
              console.warn('Failed to clear drive history:', e);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };



  const formatDuration = (seconds) => {
    const minutes = Math.round(seconds/60);
    let formatted = minutes + " min";
    if (minutes >= 60) {
      const hours = Math.floor(minutes/60);
      const min = minutes - (hours*60);
      formatted = hours + " hr " + min + " min";
    }
    return formatted;
  }

  const renderItem = ({ item }) => (
    <View style={[styles.item, { backgroundColor: itemBackground }]}>
      <Text style={[styles.date, { color: dateColor }]}>
        {new Date(item.timestamp).toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true, 
        })}
      </Text>
      <Text style={[styles.detail, { color: detailColor }]}>Points: {item.points}</Text>
      <Text style={[styles.detail, { color: detailColor }]}>
        Duration: {formatDuration(item.duration) ?? 'N/A'} 
      </Text>
      <Text
        style={[
          styles.detail,
          { color: item.distracted ? distractedColor : focusedColor },
        ]}
      >
        {item.distracted ? 'Distracted' : 'Focused'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="medium" color="#fff" />
      </View>
    );
  }

  return (
    <>

      <LinearGradient
        colors={['#0d0c42ff', '#350847ff']}   // gray → black
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.background}
      >
        <View style={styles.overlay}>
          <Text style={styles.title}>My Drives</Text>

          <FlatList
            style={styles.list}
            data={drives.slice(0, visibleCount)}
            keyExtractor={(_, index) => index.toString()}
            renderItem={renderItem}
            ListEmptyComponent={<Text style={styles.empty}>No drives yet.</Text>}
            ListFooterComponent={
              visibleCount < drives.length ? (
                <TouchableOpacity
                  style={[
                    styles.loadMoreButton,
                    {
                      backgroundColor: '#ffffff18',
                      marginBottom: 20,
                      marginTop: 10,
                      paddingHorizontal: 90,
                    },
                  ]}
                  onPress={() => setVisibleCount(prev => prev + LOAD_BATCH)}
                >
                  <Text style={styles.loadMoreButtonText}>Load More</Text>
                </TouchableOpacity>
              ) : null
            }
          />

          <TouchableOpacity onPress={clearDriveHistory} style={styles.trashButton}>
            <Ionicons name="trash-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    padding: width/25,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',  
  },
  statsButton: {
    position: 'absolute',
    top: height/10,
    right: width/15,
  },
  list: {
    marginBottom: height/300,
    padding: width/60,
    backgroundColor: 'rgba(66, 66, 66, 0.5)',
    borderRadius: 10,
  },
  title: {
    fontSize: width/12,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: height/25,
    marginBottom: height/24,
    alignSelf: 'center',
  },
  item: {
    marginBottom: height / 66.7,    
    padding: width / 25,        
    borderRadius: width / 37.5,    
  },
  date: { 
    fontSize: 16,        
    marginBottom: height / 133.4,     
  },
  detail: { 
    fontSize: 14,    
  },
  empty: {
    color: '#aaa',
    fontSize: width / 23.4,            
    textAlign: 'center',
    marginTop: height / 13.3, 
  },
  trashButton: {
    position: 'absolute',
    top: height/16,
    right: width/20,
    padding: width / 60,         
    borderRadius: width / 12.5,   
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 24, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  loadMoreButton: {
    backgroundColor: '#cc3333',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: height / (667/20),
    marginBottom: height / (667/16),
    marginTop: height / 13.3, 
  },
  loadMoreButtonText: {
    color: '#fff',
    fontSize: 16
  }
});
