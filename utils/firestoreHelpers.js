
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function ensureUserStreakFields(uid) {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const userData = userSnap.data();
    const updates = {};

    if (!('drivingStreak' in userData)) updates.drivingStreak = 0;
    if (!('lastDriveDate' in userData)) updates.lastDriveDate = null;

    if (Object.keys(updates).length > 0) {
      await updateDoc(userRef, updates);
    }
  } else {
    await setDoc(userRef, {
      drivingStreak: 0,
      lastDriveDate: null,
      settings: {
        theme: 'system',
        speedUnit: 'mph',
      }
    });
  }
}
