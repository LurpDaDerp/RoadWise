// LocationService.js
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { auth } from '../utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const db = getFirestore();
const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

function getDistance(loc1, loc2) {
  const R = 6371e3;
  const φ1 = loc1.latitude * Math.PI / 180;
  const φ2 = loc2.latitude * Math.PI / 180;
  const Δφ = (loc2.latitude - loc1.latitude) * Math.PI / 180;
  const Δλ = (loc2.longitude - loc1.longitude) * Math.PI / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

let lastLocation = null;
let lastUpdateTime = 0;

let groupIdCache = { value: null, ts: 0 };
const GROUP_CACHE_TTL_MS = 60_000; 

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return console.error(error);
  if (!data?.locations?.length) return;

  const location = data.locations[0].coords;
  const now = Date.now();

  let distanceMoved = 0;
  if (lastLocation) {
    distanceMoved = getDistance(lastLocation, location);
  }

  const timeElapsed = (now - lastUpdateTime) / 1000;
  const isFirstUpdate = !lastLocation;

  if (isFirstUpdate || (distanceMoved >= 10 && timeElapsed >= 10)) {
    lastLocation = location;
    lastUpdateTime = now;
    try {
      const user = auth.currentUser;
      if (user) {
        let groupId = groupIdCache.value;
        const stale = !groupId || (now - groupIdCache.ts) > GROUP_CACHE_TTL_MS;

        if (stale) {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          groupId = userSnap.exists() ? userSnap.data().groupId : null;
          groupIdCache = { value: groupId, ts: now };
        }

        if (groupId) {
          const groupRef = doc(db, 'groups', groupId);
            await setDoc(
              groupRef,
              {
                memberLocations: {
                  [user.uid]: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    speed: location.speed ?? 0,
                    updatedAt: new Date(),
                  },
                },
              },
              { merge: true }
            );
        }
      }
    } catch (err) {
      console.error('Error updating location:', err);
    }
  }
});

export function waitForSignedInUser(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) return resolve(auth.currentUser);

    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        if (u) {
          unsub();
          resolve(u);
        }
      },
      (err) => {
        unsub();
        reject(err);
      }
    );

    if (timeoutMs) {
      setTimeout(() => {
        unsub();
        resolve(null); 
      }, timeoutMs);
    }
  });
}


export async function startLocationUpdates() {
  const user = await waitForSignedInUser(15000);
  if (!user) {
    console.warn('No signed-in user; skipping startLocationUpdates.');
    return;
  }

  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') {
    console.warn('Foreground location permission denied');
    return;
  }

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== 'granted') {
    console.warn('Background location permission denied');
    return;
  }

   try {
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const coords = current.coords;

    const userSnap = await getDoc(doc(db, 'users', user.uid));
    const groupId = userSnap.exists() ? userSnap.data().groupId : null;

    if (groupId) {
      const groupRef = doc(db, 'groups', groupId);
      await setDoc(
        groupRef,
        {
          memberLocations: {
            [user.uid]: {
              latitude: coords.latitude,
              longitude: coords.longitude,
              speed: coords.speed ?? 0,
              updatedAt: new Date(),
              emergency: false
            },
          },
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.error("Error pushing initial location:", err);
  }

  const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

  if (!hasStarted && isTaskDefined) {
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
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
