// File: firebase.js

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC2UegRvjopP7D44-nKjooHQlkJuHsxZ8A",
  authDomain: "parichat-ilu.firebaseapp.com",
  projectId: "parichat-ilu",
  storageBucket: "parichat-ilu.firebasestorage.app",
  messagingSenderId: "425311672315",
  appId: "1:425311672315:web:da7b6ffc2847542cdd9d5e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
const realtimeDB = getDatabase(app);
const storage = getStorage(app);

// Sign in anonymously once app loads
signInAnonymously(auth).catch((error) => {
  console.error("Anonymous sign-in failed:", error);
});

export { auth, firestore, realtimeDB, storage };

/*
Note for later development:
- Video calling should mimic WhatsApp UX: incoming call screen, accept/reject, floating UI during call.
- Use WebRTC with Firebase signaling (via Realtime DB or Firestore).
- Provide seamless transitions between chat and video UI on mobile.
*/
