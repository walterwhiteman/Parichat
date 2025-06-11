// firebase.js

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js';
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  remove,
  set,
  onDisconnect,
  onValue
} from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyC2UegRvjopP7D44-nKjooHQlkJuHsxZ8A",
  authDomain: "parichat-ilu.firebaseapp.com",
  projectId: "parichat-ilu",
  storageBucket: "parichat-ilu.firebasestorage.app",
  messagingSenderId: "425311672315",
  appId: "1:425311672315:web:da7b6ffc2847542cdd9d5e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export {
  db,
  ref,
  push,
  onChildAdded,
  remove,
  set,
  onDisconnect,
  onValue
};
