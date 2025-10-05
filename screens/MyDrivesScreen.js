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
import { getUserDrives, clearUserDrives } from '../utils/firestore';
import { auth } from '../utils/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal } from 'react-native';

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

  const titleColor = isDark ? "#fff" : "#000";
  const dateColor = isDark ? '#fff' : '#000';
  const detailColor = isDark ? '#aaa' : '#353535ff';
  const textColor = isDark ? '#ffffffff' : '#252525ff';
  const distractedColor = '#cc0000';
  const focusedColor = isDark ? 'lightgreen' : 'green';
  const moduleBackground = isDark ? '#1b1b1baf' : '#e6e6e698';
  const modalBackground = isDark ? '#1b1b1bff' : '#e6e6e6ff';
  const statBackground = isDark ? '#2b2b2bff' : '#d1d1d1ff';
  const sheetGradientBottom = isDark ? "#380864ff" : "#f1f1f1ff"; 
  const sheetGradientTop = isDark ? "#070222ff" : "#cab6ffff"; 
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [showModal, setShowModal] = useState(false);


  const customFadeAnim = useRef(new Animated.Value(0)).current;
  
  const [loading, setLoading] = useState(true);

  const loadDrives = async () => {
    const user = auth.currentUser;
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
              const user = auth.currentUser;
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

  const formatDistance = (meters) => {
    const miles = meters / 1609.34;
    let formatted = miles.toFixed(1) + " mi";

    if (miles < 0.1) {
      const feet = meters * 3.28084;
      formatted = Math.round(feet) + " ft";
    }

    return formatted;
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        setSelectedDrive(item);
        setShowModal(true);
      }}
    >
      <View style={[styles.item, { backgroundColor: moduleBackground }]}>
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
        <Text style={[styles.detail, { color: detailColor }]}>
          Points: {item.points}
        </Text>
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
    </TouchableOpacity>
  );


  return (
    <>

      <LinearGradient
        colors={[sheetGradientBottom, sheetGradientTop]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.background}
      >
        <View style={styles.overlay}>
          <Text style={[styles.title, {color: titleColor}]}>My Drives</Text>

          <FlatList
            style={styles.list}
            data={drives.slice(0, visibleCount)}
            keyExtractor={(_, index) => index.toString()}
            renderItem={renderItem}
            ListEmptyComponent={<View style={styles.emptyContainer}>
              <Text style={styles.empty}>No drives yet.</Text>
            </View>}
            ListFooterComponent={
              visibleCount < drives.length ? (
                <TouchableOpacity
                  style={[
                    styles.loadMoreButton,
                    {
                      backgroundColor: '#d3d3d323',
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

          <TouchableOpacity onPress={clearDriveHistory} style={[styles.trashButton, {backgroundColor: moduleBackground}]}>
            <Ionicons name="trash-outline" size={30} color={titleColor} />
          </TouchableOpacity>
        </View>
        <Modal
          visible={showModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: modalBackground }]}>
              {selectedDrive && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: titleColor }]}>Drive Details</Text>
                    <Text style={[styles.modalDate, { color: detailColor }]}>
                      {new Date(selectedDrive.timestamp).toLocaleString()}
                    </Text>
                    <Text
                      style={[
                        styles.driveType,
                        { color: selectedDrive.distracted ? distractedColor : focusedColor },
                      ]}
                    >
                      {selectedDrive.distracted ? "Distracted Drive" : "Focused Drive"}
                    </Text>
                  </View>

                  <View style={styles.statsContainer}>
                    <View style={[styles.statBox, {backgroundColor: statBackground}]}>
                      <Text style={[styles.statLabel, {color: detailColor}]}>Distractions</Text>
                      <Text style={[styles.statValue, { color: textColor }]}>
                        {selectedDrive.distracted}
                      </Text>
                    </View>

                    <View style={[styles.statBox, {backgroundColor: statBackground}]}>
                      <Text style={[styles.statLabel, {color: detailColor}]}>Sudden Stops</Text>
                      <Text style={[styles.statValue, { color: textColor }]}>
                        {selectedDrive.suddenStops ?? 0}
                      </Text>
                    </View>

                    <View style={[styles.statBox, {backgroundColor: statBackground}]}>
                      <Text style={[styles.statLabel, {color: detailColor}]}>Sudden Accelerations</Text>
                      <Text style={[styles.statValue, { color: textColor }]}>
                        {selectedDrive.suddenAccelerations ?? 0}
                      </Text>
                    </View>

                    <View style={[styles.statBox, {backgroundColor: statBackground}]}>
                      <Text style={[styles.statLabel, {color: detailColor}]}>Speeding Events</Text>
                      <Text style={[styles.statValue, { color: textColor }]}>
                        {selectedDrive.speedingEvents ?? 0}
                      </Text>
                    </View>

                    <View style={[styles.statBox, {backgroundColor: statBackground}]}>
                      <Text style={[styles.statLabel, {color: detailColor}]}>Points</Text>
                      <Text style={[styles.statValue, { color: textColor }]}>
                        {selectedDrive.points}
                      </Text>
                    </View>

                    <View style={[styles.statBox, {backgroundColor: statBackground}]}>
                      <Text style={[styles.statLabel, {color: detailColor}]}>Distance</Text>
                      <Text style={[styles.statValue, { color: textColor }]}>
                        {formatDistance(selectedDrive.totalDistance)}
                      </Text>
                    </View>

                    <View style={[styles.statBox, {backgroundColor: statBackground}]}>
                      <Text style={[styles.statLabel, {color: detailColor}]}>Duration</Text>
                      <Text style={[styles.statValue, { color: textColor }]}>
                        {formatDuration(selectedDrive.duration)}
                      </Text>
                    </View>

                    <View style={[styles.statBox, {backgroundColor: statBackground}]}>
                      <Text style={[styles.statLabel, {color: detailColor}]}>Average Speed</Text>
                      <Text style={[styles.statValue, { color: textColor }]}>
                        {selectedDrive.avgSpeed?.toFixed?.(1) ?? "N/A"}
                      </Text>
                    </View>
                  </View>
                </>
              )}

              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={[styles.closeButton, { backgroundColor: "#444" }]}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>

        </Modal>
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
    paddingTop: width/25,
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
    padding: 24,
    borderRadius: 10,
  },
  title: {
    fontSize: width/12,
    fontWeight: 'bold',
    marginTop: height/12,
    marginBottom: height/50,
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: height * 0.6,
  },
  empty: {
    color: "#aaa",
    fontSize: 20,
    textAlign: "center",
  },
  trashButton: {
    position: 'absolute',
    bottom: height/25,
    right: width/16,
    padding: 8,         
    borderRadius: 30,   
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    borderWidth: 2,
    borderColor: "#ff4444ff",
  },
  loadMoreButton: {
    width: "100%",
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
    fontSize: 16,
    alignSelf: "center"
  },
    modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    marginVertical: 4,
  },
  closeButton: {
    marginTop: 20,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "bold",
  },
  modalDate: {
    fontSize: 14,
    marginTop: 4,
  },
  driveType: {
    marginTop: 8,
    fontWeight: "600",
    fontSize: 16,
  },
  statsContainer: {
    marginTop: 10,
  },
  statBox: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 15,
    color: "#888",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  closeButton: {
    marginTop: 20,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  closeButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});
