// public/js/firebase-init.js

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Your web app's Firebase configuration
// This configuration allows your app to connect to your specific Firebase project.
const firebaseConfig = {
    apiKey: "AIzaSyC2UegRvjopP7D44-nKjooHQlkJuHsxZ8A",
    authDomain: "parichat-ilu.firebaseapp.com",
    databaseURL: "https://parichat-ilu-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "parichat-ilu",
    storageBucket: "parichat-ilu.firebasestorage.app",
    messagingSenderId: "425311672315",
    appId: "1:425311672315:web:da7b6ffc2847542cdd9d5e"
};

// Initialize Firebase
// The main Firebase app instance.
const app = initializeApp(firebaseConfig);

// Initialize Firebase services that we will use
// Export them so they can be imported and used in other JavaScript files.
export const auth = getAuth(app); // For user authentication
export const db = getDatabase(app); // For Realtime Database operations
export const storage = getStorage(app); // For Firebase Storage (image uploads)

// Define __app_id, __firebase_config, __initial_auth_token for Canvas environment.
// These are globally provided by the Canvas runtime.
// They are checked for existence to ensure the app works both in Canvas and standalone.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfigCanvas = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Re-initialize app and services with Canvas provided config if available
// This ensures that the Firebase app instance and services use the Canvas-provided config
// when running in that environment, allowing for proper authentication and data isolation.
if (typeof __app_id !== 'undefined' && typeof __firebase_config !== 'undefined') {
    // Re-initialize app with Canvas config
    const canvasApp = initializeApp(firebaseConfigCanvas);
    
    // Re-assign exported services to use the Canvas app instance
    Object.assign(auth, getAuth(canvasApp)); 
    Object.assign(db, getDatabase(canvasApp));
    Object.assign(storage, getStorage(canvasApp));
}

// Log important variables for debugging in the Canvas environment.
console.log('Firebase Initialized!');
console.log('App ID:', appId);
console.log('Firebase Config (effective):', firebaseConfigCanvas);
console.log('Initial Auth Token (present):', initialAuthToken ? 'Yes' : 'No');

// Note: The actual sign-in with initialAuthToken will happen in auth.js
// after Firebase services are initialized.
