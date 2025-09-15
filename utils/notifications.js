// notifications.js
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { db, auth } from "./firebase";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { Alert } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions() {
  return new Promise((resolve) => {
    Alert.alert(
      "Enable Notifications",
      "We use notifications to alert you if a group member signals an emergency. Do you want to allow them?",
      [
        {
          text: "Not Now",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: "Allow",
          onPress: async () => {
            const { status } = await Notifications.requestPermissionsAsync();
            resolve(status === "granted");
          },
        },
      ]
    );
  });
}

//Push Notifs

export async function registerForPushNotificationsAsync() {
  const { status } = await Notifications.getPermissionsAsync();
  let finalStatus = status;

  if (finalStatus !== "granted") {
    const { status: askStatus } = await Notifications.requestPermissionsAsync();
    finalStatus = askStatus;
  }

  if (finalStatus !== "granted") {
    alert("Failed to get push token for push notifications!");
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig.extra.eas.projectId,
  });
  const token = tokenData.data;

  const uid = auth.currentUser?.uid;
  if (uid && token) {
    try {
      await setDoc(doc(db, "users", uid), { pushToken: token });
    } catch (err) {
      console.error("Error saving push token:", err);
    }
  }

  return token;
}

//Local notifications 

export async function scheduleDistractedNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'You got distracted!',
      body: 'Your streak has been reset.',
    },
    trigger: null,
  });
}

export async function scheduleFirstDistractedNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'You are distracted!',
      body: 'Return to the app now to avoid losing your streak.',
    },
    trigger: null,
  });
}
