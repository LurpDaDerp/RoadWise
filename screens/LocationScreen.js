import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from "react";
import { StyleSheet, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Dimensions, ScrollView, FlatList, Animated, Easing, SectionList, Keyboard, TouchableWithoutFeedback } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayRemove, arrayUnion } from "firebase/firestore";
import { getHereKey } from "../utils/firestore";
import { getAuth } from "firebase/auth";
import { ThemeContext } from "../context/ThemeContext";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import debounce from "lodash.debounce";
import { Ionicons } from "@expo/vector-icons";

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from "react-native";

const db = getFirestore();
const { width, height } = Dimensions.get('window');

export default function LocationScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState(null);
  const [location, setLocation] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [HERE_API_KEY, setHereKey] = useState();
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["10%", "40%", "90%"], []);

  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === "dark";

  const backgroundColor = isDark ? "#0f0f0fcc" : "#ffffffcc";
  const bottomSheetBackground = isDark ? "#131313ff" : "#ffffff"; 
  const moduleBackground = isDark ? '#333' : '#eeeeeeff';
  const titleColor = isDark ? "#fff" : "#000";
  const textColor = isDark ? "#fff" : "#000";
  const altTextColor = isDark ? '#aaa' : '#555';
  const buttonColor = isDark ? `rgba(124, 133, 255, 1)` : `rgba(85, 116, 255, 1)`;

  const auth = getAuth();
  const user = auth.currentUser;

  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");
  const addLocationSheetRef = useRef(null);
  const addLocationSnapPoints = useMemo(() => ["90%"], []);

  const openAddLocationSheet = () => {
    addLocationSheetRef.current?.expand();
  };

  const closeAddLocationSheet = () => {
    addLocationSheetRef.current?.close();
  };

  const handleSaveLocation = async () => {
    if (!newLocationName.trim() || !newLocationAddress.trim()) {
      Alert.alert("Missing Info", "Please provide both a name and address.");
      return;
    }

    try {
      const groupRef = doc(db, "groups", groupId);
      await updateDoc(groupRef, {
        savedLocations: arrayUnion({
          name: newLocationName,
          address: newLocationAddress,
          createdBy: user.uid,
        }),
      });

      setNewLocationName("");
      setNewLocationAddress("");
      closeAddLocationSheet();
    } catch (error) {
      console.error("Error saving location:", error);
      Alert.alert("Error", "Could not save location.");
    }
  };


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

        const savedLocations = groupData.savedLocations || [];

        for (let loc of savedLocations) {
          if (address.includes(loc.address.split(",")[0])) { 
            addressLabel = loc.name;
            break;
          }
        }

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
          isDriving: data.isDriving || false,
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

  useFocusEffect(
    useCallback(() => {
      const loadAPIKey = async () => {
        const key = await getHereKey("HERE_API_KEY");
        setHereKey(key);
      };
      
      loadAPIKey();
    }, [])
  );

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

  useEffect(() => {
    if (!groupId) return;

    const fetchLocations = async () => {
      const groupRef = doc(db, "groups", groupId);
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        const data = groupSnap.data();
        setLocations(data.savedLocations || []);
      }
    };

    fetchLocations();
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

  const fetchAddressSuggestions = useCallback(async (query) => {
    if (!query.trim() || !HERE_API_KEY) {
      setAddressSuggestions([]);
      return;
    }

    setIsFetchingSuggestions(true);
    try {
      const res = await fetch(
        `https://autocomplete.search.hereapi.com/v1/autocomplete?q=${encodeURIComponent(query)}&apiKey=${HERE_API_KEY}`
      );
      const data = await res.json();
      if (data.items) {
        setAddressSuggestions(data.items);
      }
    } catch (err) {
      console.error("HERE API error:", err);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, [HERE_API_KEY]); 

  const debouncedFetch = useMemo(
    () => debounce(fetchAddressSuggestions, 500),
    [fetchAddressSuggestions]
  );

  useEffect(() => {
    return () => {
      debouncedFetch.cancel();
    };
  }, [debouncedFetch]);

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

  const nameInputRef = useRef(null);
  const addressInputRef = useRef(null);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="medium" />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
                              top: 3,
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
              <SectionList
                contentContainerStyle={{ paddingHorizontal: 24 }}
                sections={[
                 {
                    title: "Members",
                    data: members,
                    renderItem: ({ item }) => (
                      <View style={{ marginBottom: 10, flexDirection: "row", alignItems: "center" }}>
                        
                        {item.photoURL ? (
                          <Image
                            source={{ uri: item.photoURL }}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              marginRight: 8,
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: "#666",
                              justifyContent: "center",
                              alignItems: "center",
                              marginRight: 8,
                            }}
                          >
                            <Text style={{ color: "white", fontWeight: "bold" }}>
                              {item.name[0].toUpperCase()}
                            </Text>
                          </View>
                        )}

                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                            <Text style={{ color: textColor, marginRight: 6 }}>
                              {item.name} {item.uid === user.uid ? "(You)" : ""}
                            </Text>

                            {item.isDriving && (
                              <View
                                style={{
                                  backgroundColor: "green",
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 10,
                                }}
                              >
                                <Text style={{ color: "white", fontSize: 12 }}>Driving</Text>
                              </View>
                            )}
                          </View>

                          {item.coords && (
                            <Text style={{ color: altTextColor, fontSize: 12, marginTop: 3 }}>
                              {item.address}
                            </Text>
                          )}
                        </View>

                      </View>
                    ),
                  },

                  {
                    title: "Locations",
                    data: locations.length ? locations : [{ placeholder: true }],
                      renderItem: ({ item }) =>
                        item.placeholder ? (
                          <Text style={{ color: altTextColor, fontStyle: "italic", marginTop: 8 }}>
                            No locations yet. Click the button below to add a location.
                          </Text>
                        ) : (
                          <TouchableOpacity
                            key={item.address}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: 10,
                              backgroundColor: moduleBackground,
                              borderRadius: 8,
                              marginBottom: 8,
                            }}
                            onPress={() => {
                              setNewLocationName(item.name);
                              setNewLocationAddress(item.address);
                              openAddLocationSheet();
                            }}
                          >
                            <View style={{ flexShrink: 1 }}>
                              <Text style={{ color: titleColor, fontWeight: "bold" }}>
                                {item.name}
                              </Text>
                              <Text style={{ color: altTextColor, fontSize: 12, marginRight: 5, marginTop: 3 }}>
                                {item.address}
                              </Text>
                            </View>

                            <Ionicons name="chevron-forward" size={24} color={altTextColor} />
                          </TouchableOpacity>
                        ),
                    },
                  ]}
                keyExtractor={(item, index) => index.toString()}
                renderSectionHeader={({ section: { title } }) => (
                  <Text style={[styles.subtitle, { color: titleColor, marginTop: 20 }]}>
                    {title}
                  </Text>
                )}
                ListHeaderComponent={
                  <Text style={[styles.title, { color: titleColor, marginTop: 10, marginBottom: 5 }]}>{groupName}</Text>
                }
                ListFooterComponent={
                  <View style={{ marginTop: 20 }}>
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: buttonColor, marginTop: 10, width: "100%" }]}
                      onPress={openAddLocationSheet}
                    >
                      <Text style={styles.buttonText}>Add a Location</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: "#ff2929ff", width: "100%"  }]}
                      onPress={confirmLeaveGroup}
                    >
                      <Text style={styles.buttonText}>Leave Group</Text>
                    </TouchableOpacity>
                  </View>
                }
              />

            </BottomSheetView>
          </BottomSheet>
          
        )}
        {/* Add Location Bottom Sheet */}
        <BottomSheet
          ref={addLocationSheetRef}
          index={-1}
          snapPoints={addLocationSnapPoints}
          backgroundStyle={{ backgroundColor: bottomSheetBackground }}
          handleIndicatorStyle={{ backgroundColor: altTextColor }}
          handleComponent={null}
          enablePanDownToClose={false}  
          enableContentPanningGesture={false} 
          enableHandlePanningGesture={false}
        >
          <BottomSheetView style={{ flex: 1, padding: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <TouchableOpacity onPress={() => {
                nameInputRef.current?.blur();
                addressInputRef.current?.blur();
                Keyboard.dismiss();
                closeAddLocationSheet();
                setNewLocationName("");
                setNewLocationAddress("");
                setAddressSuggestions([]);
              }}
              >
                <Text style={{ color: buttonColor, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress= {() => {
                nameInputRef.current?.blur();
                addressInputRef.current?.blur();
                Keyboard.dismiss();
                handleSaveLocation();
              }}
              
              >
                <Text style={{ color: buttonColor, fontWeight: "bold", fontSize: 16 }}>Save</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: textColor, marginTop: 30, fontWeight: "bold", fontSize: 20 }]}>Location Name</Text>
            <TextInput
              style={[styles.input, { color: textColor, width: "100%", textAlign: "left" }]}
              placeholder="e.g. Home, Office"
              placeholderTextColor={altTextColor}
              value={newLocationName}
              onChangeText={setNewLocationName}
              ref={nameInputRef}
            />

            <Text style={[styles.label, { color: textColor, marginTop: 20, fontWeight: "bold", fontSize: 20 }]}>Address</Text>
            <TextInput
              style={[styles.input, { color: textColor, width: "100%", textAlign: "left", borderColor: altTextColor }]}
              placeholder="Address"
              placeholderTextColor={altTextColor}
              value={newLocationAddress}
              ref={addressInputRef}
              onChangeText={(text) => {
                setNewLocationAddress(text);
                debouncedFetch(text);
              }}
            />
            {isFetchingSuggestions && (
              <ActivityIndicator size="small" color={titleColor} style={{ marginTop: 10 }} />
            )}

            {addressSuggestions.length > 0 && (
              <ScrollView
                style={{
                  maxHeight: height/5,
                  marginTop: 10,
                  borderWidth: 1,
                  borderColor: "#8080805e",
                  borderRadius: 8,
                  backgroundColor: isDark ? "#0c0c0cff" : "#fff",
                }}
              >
                {addressSuggestions.map((s, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: "#8080805e" }}
                    onPress={() => {
                      setNewLocationAddress(s.address.label || s.title); 
                      setAddressSuggestions([]); 
                    }}
                  >
                    <Text style={{ color: textColor }}>{s.address.label || s.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </BottomSheetView>
        </BottomSheet>

      </View>
    </GestureHandlerRootView>
    </Animated.View>
    </TouchableWithoutFeedback>
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

  title: { fontSize: 28, fontWeight: "bold", marginBottom: 15, marginTop: -10 },
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
