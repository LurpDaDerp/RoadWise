import { doc, getDoc, setDoc } from "firebase/firestore";
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
