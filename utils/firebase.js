// utils/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth'; 
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCZ6QB44EDzqaeOmBdaX8NxUtNITUivY8c",
  authDomain: "roadcash-e05e1.firebaseapp.com",
  projectId: "roadcash-e05e1",
  storageBucket: "roadcash-e05e1.appspot.com",
  messagingSenderId: "68093599355",
  appId: "1:68093599355:web:218602c86a8cc6f43c0cde",
  measurementId: "G-W5KBFD3WKZ"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
