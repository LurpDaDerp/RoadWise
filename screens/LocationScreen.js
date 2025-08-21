import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from "react";
import { StyleSheet, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Dimensions, ScrollView, FlatList, Animated, Easing } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayRemove, arrayUnion } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { ThemeContext } from "../context/ThemeContext";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from "react-native";

const db = getFirestore();
const { width, height } = Dimensions.get('window');

export default function LocationScreen() {
  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState(null);
  const [location, setLocation] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState([]);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["10%", "40%", "90%"], []);

  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === "dark";

  const backgroundColor = isDark ? "#0f0f0fcc" : "#ffffffcc";
  const titleColor = isDark ? "#fff" : "#000";
  const textColor = isDark ? "#fff" : "#000";
  const altTextColor = isDark ? '#aaa' : '#555';
  const buttonColor = isDark ? `rgba(124, 133, 255, 1)` : `rgba(85, 116, 255, 1)`;

  const auth = getAuth();
  const user = auth.currentUser;

  //get group member locations
  const fetchMembers = useCallback(async () => {
    if (!groupId) return;
    try {
      const groupRef = doc(db, "groups", groupId);
      const groupSnap = await getDoc(groupRef);

      if (!groupSnap.exists()) return;

      const groupData = groupSnap.data();
      const memberIds = groupData.members || [];

      const memberData = [];

      for (let i = 0; i < memberIds.length; i++) {
        const uid = memberIds[i];
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) continue;

        const data = userSnap.data();
        let address = "Unknown location";

        if (data.location) {
          // Round coordinates to 4 decimal places (10 meter ish)
          const lat = data.location.latitude.toFixed(4);
          const lon = data.location.longitude.toFixed(4);
          const cacheKey = `addr_${uid}_${lat}_${lon}`;

          //check cache for address
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            address = cached;
          } else {
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
                {
                  headers: {
                    "User-Agent": "RoadCash/1.0 (lurpdaderp@gmail.com)",
                    "Accept": "application/json",
                  },
                }
              );

              if (response.ok) {
                const result = await response.json();
                if (result && result.address) {
                  const { road, house_number, city, town, village, state, country } = result.address;
                  const addrParts = [
                    house_number ? house_number + " " : "",
                    road || "",
                    city || town || village || state || "",
                    country || "",
                  ].filter(Boolean);
                  address = addrParts.join(", ");
                }

                // Save grid location and reverse geocode result to cache
                await AsyncStorage.setItem(cacheKey, address);
              } else {
                console.log("Nominatim error:", response.status, response.statusText);
              }
            } catch (e) {
              console.log("Reverse geocode failed:", e);
            }

            // wait a second before the next request to respect rate limit
            await new Promise(res => setTimeout(res, 1000));
          }
        }

        memberData.push({
          uid,
          name: data.username || "Member",
          coords: data.location || null,
          address,
          photoURL: data.photoURL || null,
        });
      }

      setMembers(memberData);
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  }, [groupId]);



  const fadeInContent = useCallback(() => { 
    contentOpacity.setValue(0);
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.poly(3)),
      useNativeDriver: true,
    }).start();
  }, [contentOpacity]);

  useEffect(() => {
    const fetchGroupName = async () => {
        if (!groupId) return;
        const groupRef = doc(db, "groups", groupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
        setGroupName(groupSnap.data().groupName);
        }
    };
    fetchGroupName();
  }, [groupId]);

  //get group members and start location tracking
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      let interval;

      const fetchAndSetMembers = async () => {
        if (!isActive) return;
        await fetchMembers();
      };

      fetchAndSetMembers();

      interval = setInterval(() => {
        fetchAndSetMembers();
      }, 5000);

      return () => {
        isActive = false; 
        clearInterval(interval);
      };
    }, [fetchMembers])
  );

  //group management logic
  useEffect(() => {
    const checkGroup = async () => {
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const snapshot = await getDoc(userRef);

      if (snapshot.exists() && snapshot.data().groupId) {
        setGroupId(snapshot.data().groupId);
        startLocation();
      }
      setLoading(false);

    };
    
    checkGroup();

    contentOpacity.setValue(0); 
    fadeInContent();

  }, []);

  const startLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
        alert("Permission to access location was denied");
        return;
    }

    let currentLocation = await Location.getCurrentPositionAsync({});
    setLocation(currentLocation.coords);

    if (user) {
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, { location: currentLocation.coords }, { merge: true });
    }
  };

  const handleStartCreateGroup = () => setIsCreating(true);

  const handleConfirmCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("Missing Name", "Please enter a group name.");
      return;
    }

    const newGroupId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const userRef = doc(db, "users", user.uid);
    const groupRef = doc(db, "groups", newGroupId);

    await setDoc(groupRef, {
      createdAt: new Date(),
      createdBy: user.uid,
      members: [user.uid],
      groupName: groupName.trim(),
    });

    await setDoc(userRef, { groupId: newGroupId }, { merge: true });

    setGroupId(newGroupId);
    setIsCreating(false);
    startLocation();
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim()) return;

    const gid = joinCode.trim().toUpperCase();
    const groupRef = doc(db, "groups", gid);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
        Alert.alert("Group Not Found", "The group code you entered does not exist.");
        return;
    }

    const userRef = doc(db, "users", user.uid);

    await setDoc(userRef, { groupId: gid }, { merge: true });

    await updateDoc(groupRef, {
        members: arrayUnion(user.uid)
    });

    setGroupId(gid);
    startLocation();
  };

  const confirmLeaveGroup = () => {
    Alert.alert(
      "Leave Group",
      "Are you sure you want to leave this group?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Leave",
          style: "destructive",
          onPress: handleLeaveGroup
        }
      ],
      { cancelable: true }
    );
  };

  const handleLeaveGroup = async () => {
    if (!groupId || !user) return;

    const userRef = doc(db, "users", user.uid);
    const groupRef = doc(db, "groups", groupId);

    await setDoc(userRef, { groupId: null }, { merge: true });
    await updateDoc(groupRef, { members: arrayRemove(user.uid) });

    setGroupId(null);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="medium" />
      </View>
    );
  }

  return (
    <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {location && (
            <MapView
                style={styles.map}
                initialRegion={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
                }}
                showsUserLocation={true}
            >
                {members.map(member => 
                member.coords && (
                    <Marker
                      key={member.uid}
                      coordinate={member.coords}
                      title={member.name}
                    >
                      <View style={{ width: 50, height: 50, alignItems: 'center', marginBottom: 50 }}>
                        <Image
                          source={require('../assets/marker.png')}
                          style={{ width: 50, height: 50 }}
                          resizeMode="contain"
                        />

                        <Image
                          source={ member.photoURL ? { uri: member.photoURL } : null }
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 15,
                            position: 'absolute',
                            top: 3, 
                            
                          }}
                        />
                        
                        {!member.photoURL && (
                          <View
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 15,
                              backgroundColor: '#666',
                              position: 'absolute',
                              top: 5,
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>
                              {member.name[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Marker>
                )
                )}
            </MapView>
        )}


        {!groupId && !isCreating && (
          <LinearGradient
            colors={['#5b89ecff', '#37128fff', '#140536ff']} 
            style={styles.joinPanel}
          >
            <Text style={[styles.starttitle, { color: "#fff" }]}>
             RoadCash Circles
            </Text>

            <Text style={[styles.startsubtitle, { color: "#fff" }]}>
              Join or Create a Group
            </Text>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: buttonColor }]}
              onPress={handleStartCreateGroup}
            >
              <Text style={styles.buttonText}>Create Group</Text>
            </TouchableOpacity>

            <Text style={[styles.orText, { color: "#fff" }]}>OR</Text>

            <TextInput
              style={[styles.input, { color: textColor }]}
              placeholder="Enter group code"
              value={joinCode}
              autoCapitalize="characters"
              onChangeText={(text) => setJoinCode(text.toUpperCase())}
            />

            <TouchableOpacity
              style={[styles.button, { backgroundColor: buttonColor }]}
              onPress={handleJoinGroup}
            >
              <Text style={styles.buttonText}>Join Group</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {!groupId && isCreating && (
          <LinearGradient
            colors={['#5b89ecff', '#37128fff', '#140536ff']}
            style={styles.joinPanel}
          >
            <Text style={[styles.title, { color: "#fff" }]}>
              Enter a Group Name
            </Text>

            <TextInput
              style={[styles.input, { color: textColor }]}
              placeholder="Group name"
              value={groupName}
              onChangeText={setGroupName}
            />

            <TouchableOpacity
              style={[styles.button, { backgroundColor: buttonColor }]}
              onPress={handleConfirmCreateGroup}
            >
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsCreating(false)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {groupId && (
          <BottomSheet
            ref={bottomSheetRef}
            index={1} 
            snapPoints={snapPoints}
            backgroundStyle={{ backgroundColor }}
            handleIndicatorStyle={{ backgroundColor: altTextColor }}
            handleStyle={{ 
                height: 40, 
                backgroundColor: "#cccccc0", 
                borderRadius: 10 
            }}
          >
            <BottomSheetView>
              <FlatList
                data={members}
                keyExtractor={(item) => item.uid}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    <View style={{ marginBottom: 10 }}>
                    <Text style={{ color: textColor }}>
                        {item.name} ({item.uid === user.uid ? "You" : "Member"})
                    </Text>
                    {item.coords && (
                        <Text style={{ color: altTextColor, fontSize: 12 }}>
                          {item.address}
                        </Text>
                    )}
                    </View>
                )}
                ListHeaderComponent={
                    <View>
                        <Text style={[styles.title, { color: titleColor }]}>{groupName}</Text>
                        <Text style={[styles.subtitle, { color: titleColor }]}>Members</Text>
                    </View>
                }
                ListFooterComponent={
                    <View style={{ marginTop: 20 }}>

                    <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor, marginTop: 10 }]}>
                        <Text style={styles.buttonText}>Add a Location</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.button, { backgroundColor: "#ff2929ff"}]} onPress={confirmLeaveGroup}>
                        <Text style={styles.buttonText}>Leave Group</Text>
                    </TouchableOpacity>

                  
                    </View>
                }
              />
            </BottomSheetView>
          </BottomSheet>
        )}
      </View>
    </GestureHandlerRootView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  joinPanel: {
    position: "absolute",
    top: 0,  
    left: 0,
    right: 0,
    height: "100%",
    paddingHorizontal: width / 30,
    paddingVertical: height / 6,
    alignItems: "center",
    justifyContent: "flex-start",
  },

  title: { fontSize: 24, fontWeight: "bold", marginBottom: 15, marginTop: -10 },
  subtitle: { fontSize: 20, fontWeight: "bold", marginBottom: 10, marginTop: 5 },

  starttitle: { fontSize: 32, fontWeight: "bold", fontFamily: "Arial Rounded MT Bold", marginBottom: 25 },
  startsubtitle: { fontSize: 20, fontWeight: "bold", fontFamily: "Arial Rounded MT Bold", marginBottom: 10, marginTop: 5 },
  orText: { marginVertical: 10, fontSize: 16 },

  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 10,
    width: "90%",
    alignItems: "center",
    alignSelf: "center"
  },
  buttonText: { color: "white", fontWeight: "bold" },

  cancelButton: {
    backgroundColor: "#686868ff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 10,
    width: "90%",
    alignItems: "center",
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    width: "90%",
    marginTop: 10,
    textAlign: "center",
  },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
