// LocationService.js
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const db = getFirestore();
const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data; 
    const location = locations[0];

    if (location) {
      const { latitude, longitude } = location.coords;
      console.log('Got location:', latitude, longitude);

      try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
        const response = await fetch(url, {
          headers: { 'User-Agent': 'RoadCash/1.0' } // Required by Nominatim
        });
        const json = await response.json();
        const street = json.address?.road || json.display_name || '';

        console.log('Street info:', street);

        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(
            userRef,
            {
              location: {
                latitude,
                longitude,
                street,
                updatedAt: new Date(),
              },
            },
            { merge: true }
          );
          console.log('Location updated in Firestore');
        }
      } catch (err) {
        console.error('Error updating location:', err);
      }
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

  const isTaskDefined = await TaskManager.isTaskDefined(LOCATION_TASK_NAME);
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
    console.log('Background location tracking started');
    } catch (err) {
    console.error('Error starting location updates:', err);
    }
  }
}

export async function stopLocationUpdates() {
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  console.log('Background location tracking stopped');
}
