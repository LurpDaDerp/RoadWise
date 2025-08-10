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

  const [modalVisible, setModalVisible] = useState(false);
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


  const openModal = () => {
    setModalVisible(true);
    Animated.timing(customFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(customFadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
    });
  };

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
        Duration: {item.duration ?? 'N/A'} sec
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
      {modalVisible && (
        <Animated.View style={[styles.modalOverlay, { opacity: customFadeAnim }]} pointerEvents="box-none">
          <View style={[styles.modalContent, { backgroundColor: itemBackground }]} pointerEvents="auto">
            <Text style={[styles.modalTitle, { color: dateColor }]}>My Stats</Text>
            <Text style={[styles.modalText, { color: detailColor }]}>
                Distracted Drives: {drives.length > 0 ? distractedCount : 'N/A'}
            </Text>
            <Text style={[styles.modalText, { color: detailColor }]}>
                Focused Drives: {drives.length > 0 ? undistractedCount : 'N/A'}
            </Text>
            <Text style={[styles.modalText, { color: percentColor }]}>
                Percent Distracted: {percentDistracted !== null ? `${percentDistracted}%` : 'N/A'}
            </Text>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: closeButtonColor }]}
              onPress={closeModal}
            >
              <Text style={[styles.modalCloseText, { color: '#fff' }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      <ImageBackground
        source={require('../assets/drivehistoryback.jpg')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.openDrawer()}>
            <Ionicons name="menu" size={32} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.statsButton} onPress={openModal}>
            <Ionicons name="stats-chart" size={32} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.title}>My Drives</Text>

          <FlatList style={styles.list}
            data={drives.slice(0, visibleCount)}
            keyExtractor={(_, index) => index.toString()}
            renderItem={renderItem}
            ListEmptyComponent={<Text style={styles.empty}>No drives yet.</Text>}
            ListFooterComponent={
                visibleCount < drives.length ? (
                <TouchableOpacity
                    style={[styles.clearButton, { backgroundColor: '#ffffff18', marginBottom: 20, marginTop: 10, paddingHorizontal: 90 }]}
                    onPress={() => setVisibleCount(prev => prev + LOAD_BATCH)}
                >
                    <Text style={styles.clearButtonText}>Load More</Text>
                </TouchableOpacity>
                ) : null
            }
          />

          <TouchableOpacity onPress={clearDriveHistory} style={styles.trashButton}>
            <Ionicons name="trash-outline" size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      </ImageBackground>
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
    padding: width/18,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',  
  },
  menuButton: {
    position: 'absolute',
    top: height/10,
    left: width/15,
  },
  statsButton: {
    position: 'absolute',
    top: height/10,
    right: width/15,
  },
  list: {
    marginBottom: height/13,
    padding: width/40,
    backgroundColor: 'rgba(107, 107, 107, 0.5)',
    borderRadius: 10,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalContent: {
    width: '80%',
    padding: width/12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: width/12,
    fontWeight: 'bold',
    marginBottom: width/20,
  },
  modalText: {
    fontSize: width/20,
    textAlign: 'center',
    marginBottom: width/55,
  },
  modalCloseText: {
    fontSize: width/24,
    textAlign: 'center',
  },
  modalButton: {
    marginTop: height/40,
    paddingHorizontal: width/5,
    paddingVertical: width/40,
    borderRadius: 10,
  },
  title: {
    fontSize: width/11,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: height/17,
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
    bottom: height / 33.35, 
    left: width / 18.75,     
    padding: width / 37.5,         
    borderRadius: width / 12.5,   
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});
