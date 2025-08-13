import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, orderBy, query, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from './firebase';

export async function getUserPoints(uid) {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data().points || 0;
  } else {
    await setDoc(docRef, { points: 0 });
    return 0;
  }
}

export async function saveUserPoints(uid, points) {
  const docRef = doc(db, "users", uid);
  await setDoc(docRef, { points }, { merge: true });
}

export async function saveUserStreak(uid, streak) {
  if (!uid) return;
  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, { drivingStreak: streak });
  } catch (error) {
    console.error('Failed to save user streak:', error);
  }
}

export async function saveTrustedContacts(uid, contacts) {
  if (!uid) return;
  const userRef = doc(db, "users", uid);
  try {
    await setDoc(userRef, { trustedContacts: contacts }, { merge: true });
  } catch (error) {
    console.error("Error saving trusted contacts:", error);
  }
}

export async function getTrustedContacts(uid) {
  if (!uid) return [];
  const userRef = doc(db, "users", uid);
  try {
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      return docSnap.data().trustedContacts || [];
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error loading trusted contacts:", error);
    return [];
  }
}

export async function saveUserDrive(uid, driveData) {
  if (!uid) return;
  try {
    const drivesRef = collection(db, "users", uid, "drives");
    await addDoc(drivesRef, {
      ...driveData,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Failed to save user drive:", err);
  }
}

export async function getUserDrives(uid) {
  if (!uid) return [];
  try {
    const drivesRef = collection(db, "users", uid, "drives");
    const q = query(drivesRef, orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    const drives =  snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || new Date()
    }));
    return drives;
  } catch (error) {
    console.error("Error loading user drives:", error);
    return [];
  }
}

export async function clearUserDrives(uid) {
  if (!uid) return;
  try {
    const drivesRef = collection(db, "users", uid, "drives");
    const snapshot = await getDocs(drivesRef);
    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, "users", uid, "drives", docSnap.id));
    }
  } catch (error) {
    console.error("Error clearing user drives:", error);
  }
}

export async function getHereKey(key) {
  const docRef = doc(db, "apikeys", key); 
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data().value : null;
}