// notifications.js
import * as Notifications from 'expo-notifications';

export async function requestNotificationPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    alert('Notification permissions not granted!');
    return false;
  }
  return true;
}

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
      body: 'Return to the app within 5 seconds to avoid losing your streak.',
    },
    trigger: null,
  });
}
