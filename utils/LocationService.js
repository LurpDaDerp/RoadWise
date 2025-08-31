// LocationService.js
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { auth } from '../utils/firebase';

const db = getFirestore();
const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

let lastUpdateTime = 0;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }

  if (data?.locations?.length) {
    const location = data.locations[0];
    const { latitude, longitude, speed } = location.coords;

    const interval = speed != null && speed > 5 ? 10000 : 30000;
    const now = Date.now();

    if (now - lastUpdateTime < interval) return;
    lastUpdateTime = now;

    try {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(
          userRef,
          {
            location: {
              latitude,
              longitude,
              speed: speed != null ? speed : 0,
              updatedAt: new Date(),
            },
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.error('Error updating location:', err);
    }
  }
});


export async function startLocationUpdates() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    console.warn('Foreground location permission denied');
    return;
  }

  if (Platform.OS === 'android') {
    const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus.status !== 'granted') {
      console.warn('Background location permission denied');
    }
  }

  const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

  if (!hasStarted && isTaskDefined) {
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 0,
        foregroundService: {
          notificationTitle: 'Tracking location',
          notificationBody: 'Your location is being tracked in the background',
        },
        pausesUpdatesAutomatically: false,
      });
    } catch (err) {
      console.error('Error starting location updates:', err);
    }
  }
}

export async function stopLocationUpdates() {
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}
