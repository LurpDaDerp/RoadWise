// LocationService.js
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { auth } from '../utils/firebase';

const db = getFirestore();
const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

function getDistance(loc1, loc2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = loc1.latitude * Math.PI / 180;
  const φ2 = loc2.latitude * Math.PI / 180;
  const Δφ = (loc2.latitude - loc1.latitude) * Math.PI / 180;
  const Δλ = (loc2.longitude - loc1.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // distance in meters
}

let lastLocation = null; 

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return console.error(error);
  if (!data?.locations?.length) return;

  const location = data.locations[0].coords;

  if (lastLocation) {
    const distanceMoved = getDistance(lastLocation, location);
    if (distanceMoved < 10) return; 
  }

  lastLocation = location;

  try {
    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          speed: location.speed ?? 0,
          updatedAt: new Date(),
        },
      }, { merge: true });
    }
  } catch (err) {
    console.error('Error updating location:', err);
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
        distanceInterval: 10, 
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
