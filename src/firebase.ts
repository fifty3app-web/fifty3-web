import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
console.log("🔥 Firebase config:", import.meta.env);
const firebaseConfig = {
  apiKey: "AIzaSyB--nzndt4u_of_el3s8EGCxxlVk_1u2ow",
  authDomain: "fifty3-gym.firebaseapp.com",
  projectId: "fifty3-gym",
  storageBucket: "fifty3-gym.firebasestorage.app",
  messagingSenderId: "383517676474",
  appId: "1:383517676474:web:5445aafd1e9f9c66d78383",
  measurementId: "G-1Y3QH30LTD",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);


