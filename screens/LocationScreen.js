import React, { useEffect, useState, useContext, useRef, useMemo, useCallback, useLayoutEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Dimensions, ScrollView, FlatList, Animated, Easing, SectionList, Keyboard, TouchableWithoutFeedback } from "react-native";
import MapView, { Marker, AnimatedRegion } from "react-native-maps";
import * as Location from "expo-location";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayRemove, arrayUnion, onSnapshot, deleteField, collection, getDocs, query, where } from "firebase/firestore";
import { getHereKey } from "../utils/firestore";
import { auth } from '../utils/firebase';
import { ThemeContext } from "../context/ThemeContext";
import BottomSheet, { BottomSheetView, BottomSheetSectionList } from "@gorhom/bottom-sheet";
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import debounce from "lodash.debounce";
import { Ionicons } from "@expo/vector-icons";
import { waitForSignedInUser, startLocationUpdates, stopLocationUpdates } from "../utils/LocationService";

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from "react-native";
import { add } from "date-fns";

const db = getFirestore();
const { width, height } = Dimensions.get('window');

function normalizeAddress(addr) {
  if (!addr) return "";

  const directionMap = {
    north: "N",
    south: "S",
    east: "E",
    west: "W",
    northeast: "NE",
    northwest: "NW",
    southeast: "SE",
    southwest: "SW"
  };

  const streetTypeMap = {
    avenue: "Ave",
    place: "Pl",
    street: "St",
    road: "Rd",
    boulevard: "Blvd",
    drive: "Dr",
    court: "Ct",
    lane: "Ln",
    terrace: "Ter",
    parkway: "Pkwy",
    circle: "Cir"
  };

  const stateAbbreviations = {
    "Alabama": "AL",
    "Alaska": "AK",
    "Arizona": "AZ",
    "Arkansas": "AR",
    "California": "CA",
    "Colorado": "CO",
    "Connecticut": "CT",
    "Delaware": "DE",
    "Florida": "FL",
    "Georgia": "GA",
    "Hawaii": "HI",
    "Idaho": "ID",
    "Illinois": "IL",
    "Indiana": "IN",
    "Iowa": "IA",
    "Kansas": "KS",
    "Kentucky": "KY",
    "Louisiana": "LA",
    "Maine": "ME",
    "Maryland": "MD",
    "Massachusetts": "MA",
    "Michigan": "MI",
    "Minnesota": "MN",
    "Mississippi": "MS",
    "Missouri": "MO",
    "Montana": "MT",
    "Nebraska": "NE",
    "Nevada": "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    "Ohio": "OH",
    "Oklahoma": "OK",
    "Oregon": "OR",
    "Pennsylvania": "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    "Tennessee": "TN",
    "Texas": "TX",
    "Utah": "UT",
    "Vermont": "VT",
    "Virginia": "VA",
    "Washington": "WA",
    "West Virginia": "WV",
    "Wisconsin": "WI",
    "Wyoming": "WY"
  };

  const numberMap = {
    first: "1st",
    second: "2nd",
    third: "3rd",
    fourth: "4th",
    fifth: "5th",
    sixth: "6th",
    seventh: "7th",
    eighth: "8th",
    ninth: "9th",
    tenth: "10th",
    eleventh: "11th",
    twelfth: "12th",
    thirteenth: "13th",
    fourteenth: "14th",
    fifteenth: "15th",
    twentieth: "20th",
    thirtieth: "30th",
    fortieth: "40th",
    fiftieth: "50th",
  };

  // lowercase and remove punctuation
  let normalized = addr.toLowerCase().replace(/[.,]/g, "");

  // direction abbreviations
  Object.entries(directionMap).forEach(([word, abbr]) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    normalized = normalized.replace(regex, abbr);
  });

  // street type abbreviations
  Object.entries(streetTypeMap).forEach(([word, abbr]) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    normalized = normalized.replace(regex, abbr);
  });

  // normalize state names to abbreviations
  Object.entries(stateAbbreviations).forEach(([state, abbr]) => {
    const regex = new RegExp(`\\b${state.toLowerCase()}\\b`, "gi");
    normalized = normalized.replace(regex, abbr);
  });

  // remove zip codes 
  normalized = normalized.replace(/\b\d{5}(?:-\d{4})?\b/g, "");

  // no multi spaces
  normalized = normalized.replace(/\s+/g, " ").trim();

  //lowercase all again 
  normalized = normalized.toLowerCase();

  return normalized;
}

function compareAddresses(addr1, addr2, threshold = 0.7) {
  if (!addr1 || !addr2) return false;

  const tokens1 = addr1.split(" ").filter(Boolean);
  const tokens2 = addr2.split(" ").filter(Boolean);

  //exact match
  if (tokens1.join(" ") === tokens2.join(" ")) return true;

  //longest matching sequence in order
  let i = 0, j = 0, matches = 0;

  while (i < tokens1.length && j < tokens2.length) {
    if (tokens1[i] === tokens2[j]) {
      matches++;
      i++;
      j++;
    } else {
      j++;
    }
  }

  // fraction of tokens matched relative to shorter address
  const fractionMatched = matches / Math.min(tokens1.length, tokens2.length);

  return fractionMatched >= threshold;
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // meters
  const toRad = x => (x * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function LocationScreen() {

  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: { display: 'none' },
    });

    return () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: {
          display: 'flex',
        },
      });
    };
  }, [navigation]);

  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState(null);
  const [location, setLocation] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState([]);
  const memberProfilesRef = useRef({});
  const fetchedProfilesOnce = useRef(false);
  const [locations, setLocations] = useState([]);
  const [editingLocation, setEditingLocation] = useState(null);
  const [HERE_API_KEY, setHereKey] = useState();
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const mapRef = useRef(null);
  const lastFetchTimes = useRef({});
  const memberUnsubs = useRef({});
  const lastLocations = useRef({});

  const myAnimatedCoord = useRef(
    new AnimatedRegion({
      latitude: 0,
      longitude: 0,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    })
  ).current;

  const PulseRing = () => {
    const scale = useRef(new Animated.Value(0.2)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      const loop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 2.5,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 0.2,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, [scale, opacity]);

    return (
      <Animated.View
        style={{
          position: "absolute",
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: "rgba(255, 58, 48, 0.77)",
          transform: [{ scale }],
          opacity,
        }}
      />
    );
  };


  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["15%", "40%", "90%"], []);

  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === "dark";

  const backgroundColor = isDark ? "#070707cc" : "#ffffffcc";
  const bottomSheetBackground = isDark ? "#131313ff" : "#ffffff"; 
  const moduleBackground = isDark ? '#2c2c2cff' : '#ddddddff';
  const titleColor = isDark ? "#fff" : "#000";
  const textColor = isDark ? "#fff" : "#000";
  const altTextColor = isDark ? '#aaa' : '#555';
  const buttonColor = isDark ? `rgba(92, 179, 238, 1)` : `rgba(69, 146, 235, 1)`;
  const sheetGradientTop = isDark ? "#1f1f1fe1" : "#ffffffcc"; 
  const sheetGradientBottom = isDark ? "#0d061be1" : "#c0c0c0d0"; 

  const user = auth.currentUser;

  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");
  const addLocationSheetRef = useRef(null);
  const addLocationSnapPoints = useMemo(() => ["90%"], []);

  async function fetchProfilesOnce(uids) {
    
    const chunks = [];
    for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));

    for (const ids of chunks) {
      try {
        const q = query(collection(db, "users"), where("__name__", "in", ids));
        const qs = await getDocs(q);
        qs.forEach(snap => {
          const u = snap.data();
          memberProfilesRef.current[snap.id] = {
            name: u.username || "Member",
            photoURL: u.photoURL || null,
          };
        });
        ids.forEach(id => {
          if (!memberProfilesRef.current[id]) {
            memberProfilesRef.current[id] = { name: "Member", photoURL: null };
          }
        });
      } catch (e) {
        console.error("fetchProfilesOnce failed for", ids, e);
        ids.forEach(id => {
          if (!memberProfilesRef.current[id]) {
            memberProfilesRef.current[id] = { name: "Member", photoURL: null };
          }
        });
      }
    }
  }

  useEffect(() => {
    const subscription = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        distanceInterval: 1,
      },
      (loc) => {
        const { latitude, longitude } = loc.coords;
        setLocation({ latitude, longitude });

        myAnimatedCoord.timing({
          latitude,
          longitude,
          duration: 1000,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => subscription.then((sub) => sub.remove());
  }, []);


  const [userData, setUserData] = useState(null);


  const openAddLocationSheet = () => {
    addLocationSheetRef.current?.expand();
  };

  const closeAddLocationSheet = () => {
    addLocationSheetRef.current?.close();
  };

  const handleDeleteLocation = async () => {
    if (!groupId || !editingLocation) return;

    Alert.alert(
      "Delete Location",
      "Are you sure you want to remove this location?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const groupRef = doc(db, "groups", groupId);

              await updateDoc(groupRef, {
                savedLocations: arrayRemove(editingLocation),
              });

              setLocations(prev =>
                prev.filter(
                  loc =>
                    loc.name !== editingLocation.name || loc.address !== editingLocation.address
                )
              );

              setNewLocationName("");
              setNewLocationAddress("");
              setEditingLocation(null);
              closeAddLocationSheet();

            } catch (error) {
              console.error("Error deleting location:", error);
              Alert.alert("Error", "Could not delete location.");
            }
          }
        }
      ],
      { cancelable: true }
    );
  };


  const handleSaveLocation = async () => {
    if (!newLocationName.trim() || !newLocationAddress.trim()) {
      Alert.alert("Missing Info", "Please provide both a name and address.");
      return;
    }

    try {
      const groupRef = doc(db, "groups", groupId);

      if (editingLocation) {
        await updateDoc(groupRef, {
          savedLocations: arrayRemove(editingLocation)
        });

        setLocations(prev =>
          prev.filter(
            loc =>
              loc.name !== editingLocation.name || loc.address !== editingLocation.address
          )
        );
      } else {
        const nameTaken = locations.some(
          loc => loc.name.trim().toLowerCase() === newLocationName.trim().toLowerCase()
        );
        const addressTaken = locations.some(
          loc => loc.address.trim().toLowerCase() === newLocationAddress.trim().toLowerCase()
        );

        if (nameTaken) {
          Alert.alert("Duplicate Name", "A location with this name already exists.");
          return;
        }
        if (addressTaken) {
          Alert.alert("Duplicate Address", "A location with this address already exists.");
          return;
        }
      }

      const newLoc = {
        name: newLocationName.trim(),
        address: newLocationAddress.trim(),
        createdBy: user.uid
      };

      await updateDoc(groupRef, {
        savedLocations: arrayUnion(newLoc)
      });

      setLocations(prev => [...prev, newLoc]);

      setNewLocationName("");
      setNewLocationAddress("");
      setEditingLocation(null);
      closeAddLocationSheet();

    } catch (error) {
      console.error("Error saving location:", error);
      Alert.alert("Error", "Could not save location.");
    }
  };

  const getAddressForUser = async (uid, data, savedLocations, normalizedSavedLocations) => {
    let address = "Unknown location";

    if (!data.location) return address;

    const speed = data.location.speed || 0;
    const lat = data.location.latitude.toFixed(5);
    const lon = data.location.longitude.toFixed(5);
    const cacheKey = `addr_${lat}_${lon}`;

    // Check cache
    let cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      address = cached;
    }

    const now = Date.now();

    if (!cached) {
    const lastFetch = lastFetchTimes.current[uid] || 0;
    lastFetchTimes.current[uid] = now;
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
            address = addrParts.join(" ");
          }
          if (address !== "Unknown location") {
            await AsyncStorage.setItem(cacheKey, address);
          }
        }
      } catch (e) {
        console.warn("Reverse geocode failed:", e);
      }
      await new Promise(res => setTimeout(res, 1000));
    }

    // Check if matches saved location
    const normalized = normalizeAddress(address);
    const match = normalizedSavedLocations.find(loc =>
      compareAddresses(normalized, loc.normalizedAddress)
    );
    if (match) {
      address = match.name;
    }

    return address;
  };


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


  useFocusEffect(
    useCallback(() => {
      if (!groupId) return;

      const groupRef = doc(db, "groups", groupId);

      const unsubGroup = onSnapshot(groupRef, async (groupSnap) => {
        if (!groupSnap.exists()) return;

        const groupData = groupSnap.data();
        const memberLocations = groupData.memberLocations || {};
        const savedLocations = groupData.savedLocations || [];
        const memberIds = Object.keys(memberLocations);
        setGroupName(groupData.groupName || "");
        setLocations(groupData.savedLocations || []);

        const missing = memberIds.filter(id => !memberProfilesRef.current[id]);
        if (missing.length > 0) {
          await fetchProfilesOnce(missing);
        }

        const normalizedSavedLocations = savedLocations.map((loc) => ({
          ...loc,
          normalizedAddress: normalizeAddress(loc.address),
        }));


        const updates = await Promise.all(
          Object.entries(memberLocations).map(async ([uid, coords]) => {
            let address;

            if (coords?.latitude != null && coords?.longitude != null) {
              const last = lastLocations.current?.[uid];
              let shouldFetch = false;

              if (!last) shouldFetch = true;
              else {
                const dist = getDistance(
                  last.latitude,
                  last.longitude,
                  coords.latitude,
                  coords.longitude
                );
                if (dist >= 10) shouldFetch = true;
              }

              if (shouldFetch) {
                (lastLocations.current || (lastLocations.current = {}))[uid] = {
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                };
                address = await getAddressForUser(
                  uid,
                  { location: coords },
                  savedLocations,
                  normalizedSavedLocations
                );
              }
            }

            return { uid, coords, address };
          })
        );


        setMembers((prev) => {
          const prevMap = new Map(prev.map((m) => [m.uid, m]));
          updates.forEach(({ uid, coords, address }) => {
            const profile = memberProfilesRef.current?.[uid];
            const name = profile?.name ?? coords?.username ?? "Member";
            const photoURL = profile?.photoURL ?? coords?.photoURL ?? null;

            const prevItem = prevMap.get(uid);

            let renderCoord = prevItem?.renderCoord;
            if (
              coords?.latitude != null &&
              coords?.longitude != null &&
              (!renderCoord ||
                renderCoord.latitude !== coords.latitude ||
                renderCoord.longitude !== coords.longitude)
            ) {
              renderCoord = { latitude: coords.latitude, longitude: coords.longitude };
            }

            prevMap.set(uid, {
              uid,
              name,
              photoURL,
              coords: coords || prevItem?.coords || null,  
              renderCoord,   
              isDriving: (coords?.speed ?? 0) > 10,
              emergency: !!coords?.emergency,
              address: address ?? prevItem?.address ?? null,
            });

          });

          for (const oldUid of Array.from(prevMap.keys())) {
            if (!memberIds.includes(oldUid)) prevMap.delete(oldUid);
          }
          return Array.from(prevMap.values());
        });

        if (initialLoad) setInitialLoad(false);
      });

      return () => {
        return unsubGroup();
      };
      
    }, [groupId])
  );



  //group management logic
  useEffect(() => {
    const checkGroup = async () => {
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const snapshot = await getDoc(userRef);

      if (snapshot.exists() && snapshot.data().groupId) {
        setGroupId(snapshot.data().groupId);
      } 
      setLoading(false);

    };
    
    checkGroup();

    contentOpacity.setValue(0); 
    fadeInContent();

  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const userRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      }
    };

    fetchUser();
  }, []);


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

    await setDoc(userRef, { groupId: newGroupId }, { merge: true });

    const { coords } = await Location.getCurrentPositionAsync({});

    await setDoc(groupRef, {
      createdAt: new Date(),
      createdBy: user.uid,
      groupName: groupName.trim(),
      memberLocations: {
        [user.uid]: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          speed: coords.speed,
          updatedAt: new Date(),
        },
      },
    });

    await setDoc(userRef, { groupId: newGroupId }, { merge: true });

    setGroupId(newGroupId);
    setIsCreating(false);
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

    const { coords } = await Location.getCurrentPositionAsync({});

    await setDoc(
      groupRef,
      {
        memberLocations: {
          [user.uid]: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            speed: coords.speed,
            updatedAt: new Date(),
          },
        },
      },
      { merge: true }
    );

    setGroupId(gid);

    startLocationUpdates();
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

    await updateDoc(groupRef, {
      [`memberLocations.${user.uid}`]: deleteField(),
    });

    setGroupId(null);

    stopLocationUpdates(); 
  };

  const nameInputRef = useRef(null);
  const addressInputRef = useRef(null);

  const background = (props) => {
    return (
      <LinearGradient
        colors={[sheetGradientTop, sheetGradientBottom]}
        style={[
          { flex: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
          props.style,
        ]}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" />
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
              ref={mapRef}
                style={styles.map}
                initialRegion={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
                }}
              showsUserLocation={true}
            >
              

              {members
                .filter(member => member.uid !== user.uid && member.coords)
                .map(member => (
                    <Marker
                      key={member.uid}
                      coordinate={member.coords}
                      title={member.name}
                    >
                      <View style={{ width: 50, height: 50, alignItems: 'center', marginBottom: 50 }}>
                        {member.emergency && <PulseRing />}
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

              {location && (
                <Marker.Animated coordinate={myAnimatedCoord} title="You" tracksViewChanges={false}>
                  <View style={{ width: 50, height: 50, alignItems: 'center', marginBottom: 50 }}>
                    <Image
                      source={require('../assets/marker.png')}
                      style={{ width: 50, height: 50 }}
                      resizeMode="contain"
                    />

                    {userData?.photoURL ? (
                      <Image
                        source={{ uri: userData.photoURL }}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          position: 'absolute',
                          top: 3,
                        }}
                      />
                    ) : (
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
                          {user.username?.[0]?.toUpperCase() ?? 'Me'}
                        </Text>
                      </View>
                    )}
                  </View>
                </Marker.Animated>
              )}
            </MapView>
        )}


        {!groupId && !isCreating && (
          <LinearGradient
            colors={['#5b89ecff', '#37128fff', '#140536ff']} 
            style={styles.joinPanel}
          >
            <Text style={[styles.starttitle, { color: "#fff" }]}>
              RoadCash Groups
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
            backgroundComponent={background}
            handleIndicatorStyle={{ backgroundColor: altTextColor }}
            handleStyle={{ 
                height: 40, 
                backgroundColor: "#cccccc0", 
                borderRadius: 10 
            }}
          >
              {initialLoad ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center", height: 200 }}>
                  <ActivityIndicator size="small" color={altTextColor} />
                </View>
              ) : (
              <BottomSheetSectionList
                stickySectionHeadersEnabled={false} 
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

                            {item.emergency && (
                              <View
                                style={{
                                  backgroundColor: "#ff3b30",
                                  paddingHorizontal: 8,
                                  paddingVertical: 2,
                                  borderRadius: 10,
                                }}
                              >
                                <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 12 }}>
                                  Emergency
                                </Text>
                              </View>
                            )}
                            {item.isDriving && (
                              <View
                                style={{
                                  backgroundColor: "green",
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 10,
                                }}
                              >
                                <Text style={{ color: "white", fontSize: 12 }}>Driving ({((item.coords?.speed ?? 0) * 2.23694).toFixed(1)} mph)</Text>
                              </View>
                            )}
                            
                          </View>

                          {item.coords && (
                            <Text style={{ color: altTextColor, fontSize: 12, marginTop: 3 }}>
                              {item.address}
                            </Text>
                          )}
                        </View>

                        {item.coords && (
                          <TouchableOpacity
                            onPress={() => {
                              bottomSheetRef.current?.snapToIndex(0);
                              mapRef.current?.animateToRegion(
                                {
                                  latitude: item.coords.latitude,
                                  longitude: item.coords.longitude,
                                  latitudeDelta: 0.01,
                                  longitudeDelta: 0.01,
                                },
                                500
                              );
                            }}
                            style={{
                              padding: 6,
                              borderRadius: 20,
                              backgroundColor: item.coords?.emergency ? '#ff3b30' : moduleBackground,
                              marginLeft: 10,
                            }}
                          >
                            <Ionicons
                              name={item.coords?.emergency ? 'location-sharp' : 'location-outline'}
                              size={20}
                              color={item.coords?.emergency ? '#ffffff' : textColor}
                            />
                          </TouchableOpacity>
                        )}

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
                              minHeight: 70,
                            }}
                            onPress={() => {
                              setNewLocationName(item.name);
                              setNewLocationAddress(item.address);
                              setEditingLocation(item);
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
                keyExtractor={(item) => item.uid || item.address || Math.random().toString()}
                renderSectionHeader={({ section: { title } }) => (
                  <Text style={[styles.subtitle, { color: titleColor, marginTop: 20 }]}>
                    {title}
                  </Text>
                )}
                ListHeaderComponent={
                  <Text style={[styles.title, { color: titleColor, marginTop: 10, marginBottom: 5 }]}>{groupName}</Text>
                }
                ListFooterComponent={
                  <View style={{ marginTop: 0 }}>
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: buttonColor, marginTop: 10, width: "100%", marginBottom: 40 }]}
                      onPress={openAddLocationSheet}
                    >
                      <Text style={styles.buttonText}>Add a Location</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: "#ff2929ff", width: "100%", marginBottom: 20 }]}
                      onPress={confirmLeaveGroup}
                    >
                      <Text style={styles.buttonText}>Leave Group</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
              )}

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
              style={[styles.input, { color: textColor, width: "100%", textAlign: "left", borderColor: altTextColor  }]}
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
                  maxHeight: height/3,
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

            {locations.some(
              loc =>
                loc.name === newLocationName && loc.address === newLocationAddress
            ) && (
              <TouchableOpacity
                style={{
                  marginTop: 20,
                  backgroundColor: "#ff2626ff",
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: "center",
                }}
                onPress={handleDeleteLocation}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>Delete Location</Text>
              </TouchableOpacity>
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
