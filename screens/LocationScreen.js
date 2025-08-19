import React, { useEffect, useState, useContext, useRef, useMemo } from "react";
import { StyleSheet, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert, Dimensions, ScrollView, FlatList } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayRemove, arrayUnion } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { ThemeContext } from "../context/ThemeContext";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";

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

  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["10%", "40%", "90%"], []);

  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === "dark";

  const backgroundColor = isDark ? "#0f0f0fbb" : "#ffffffcc";
  const titleColor = isDark ? "#fff" : "#000";
  const textColor = isDark ? "#fff" : "#000";
  const altTextColor = isDark ? '#aaa' : '#555';
  const buttonColor = isDark ? `rgba(108, 55, 255, 1)` : `rgba(99, 71, 255, 1)`;

  const auth = getAuth();
  const user = auth.currentUser;

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

    const fetchMembers = async () => {
        const groupRef = doc(db, "groups", groupId);
        const groupSnap = await getDoc(groupRef);

        if (groupSnap.exists()) {
        const memberIds = groupSnap.data().members || [];

        // Fetch each member's location
        const memberData = await Promise.all(
            memberIds.map(async uid => {
            const userRef = doc(db, "users", uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const data = userSnap.data();
                return {
                uid,
                name: data.username || "Member",
                coords: data.location || null, // location stored in user doc
                };
            }
            return null;
            })
        );

        setMembers(memberData.filter(Boolean));
        }
    };

    fetchMembers();

    // Optional: real-time updates using onSnapshot
    // const unsub = onSnapshot(doc(db, "groups", groupId), fetchMembers);
    // return () => unsub();
  }, [groupId]);

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

    // 1️⃣ Update user's doc
    await setDoc(userRef, { groupId: gid }, { merge: true });

    // 2️⃣ Add user to group's members array
    await updateDoc(groupRef, {
        members: arrayUnion(user.uid)
    });

    setGroupId(gid);
    startLocation();
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
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
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
                {/* Map Markers for all members */}
                {members.map(member => 
                member.coords && (
                    <Marker
                    key={member.uid}
                    coordinate={member.coords}
                    title={member.name}
                    pinColor={member.uid === user.uid ? "blue" : "green"} // optional: differentiate user
                    />
                )
                )}
            </MapView>
        )}


        {!groupId && !isCreating && (
          <View style={[styles.joinPanel, { backgroundColor }]}>
            <Text style={[styles.title, { color: titleColor }]}>Join or Create a Group</Text>
            <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={handleStartCreateGroup}>
              <Text style={styles.buttonText}>Create Group</Text>
            </TouchableOpacity>
            <Text style={[styles.orText, { color: textColor }]}>OR</Text>
            <TextInput
              style={[styles.input, { color: textColor }]}
              placeholder="Enter group code"
              value={joinCode}
              onChangeText={setJoinCode}
            />
            <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={handleJoinGroup}>
              <Text style={styles.buttonText}>Join Group</Text>
            </TouchableOpacity>
          </View>
        )}

        {!groupId && isCreating && (
          <View style={[styles.joinPanel, { backgroundColor }]}>
            <Text style={[styles.title, { color: titleColor }]}>Enter a Group Name</Text>
            <TextInput
              style={[styles.input, { color: textColor }]}
              placeholder="Group name"
              value={groupName}
              onChangeText={setGroupName}
            />
            <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor }]} onPress={handleConfirmCreateGroup}>
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setIsCreating(false)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Gorhom Bottom Sheet for group details */}
        {groupId && (
          <BottomSheet
            ref={bottomSheetRef}
            index={1} // initial snap point
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
                        Lat: {item.coords.latitude.toFixed(5)}, Lng: {item.coords.longitude.toFixed(5)}
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
                    {/* Example extra options */}
                    <TouchableOpacity style={[styles.button, { backgroundColor: "red" }]} onPress={handleLeaveGroup}>
                        <Text style={styles.buttonText}>Leave Group</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.button, { backgroundColor: buttonColor, marginTop: 10 }]}>
                        <Text style={styles.buttonText}>Some Other Option</Text>
                    </TouchableOpacity>

                    <Text style={{ color: altTextColor, marginTop: 20 }}>
                        Additional info or instructions here...
                    </Text>
                    </View>
                }
              />
            </BottomSheetView>
          </BottomSheet>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  joinPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "100%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: width / 30,
    paddingVertical: height / 4,
    alignItems: "center",
  },

  title: { fontSize: 24, fontWeight: "bold", marginBottom: 15, marginTop: -10 },
  subtitle: { fontSize: 20, fontWeight: "bold", marginBottom: 10, marginTop: 5 },
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
