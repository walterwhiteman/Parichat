// chatroom.js
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  set,
  onDisconnect,
  remove
} from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js';
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js';
import { app } from './firebase.js';

const db = getDatabase(app);
const storage = getStorage(app);

const chatBox = document.getElementById('chatBox');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const uploadBtn = document.getElementById('uploadBtn');
const startCallBtn = document.getElementById('startCallBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

const username = localStorage.getItem('username');
const roomId = localStorage.getItem('roomId');

const messagesRef = ref(db, `rooms/${roomId}/messages`);

function appendMessage(data) {
  const div = document.createElement('div');
  div.className = 'message';
  if (data.type === 'text') {
    div.innerHTML = `<div>${data.content}</div><div class="meta">${data.sender} · ${new Date(data.timestamp).toLocaleTimeString()}</div>`;
  } else if (data.type === 'image') {
    div.innerHTML = `<img src="${data.content}" style="max-width: 70%; border-radius: 8px;" /><div class="meta">${data.sender} · ${new Date(data.timestamp).toLocaleTimeString()}</div>`;
  }
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

onChildAdded(messagesRef, (snapshot) => {
  appendMessage(snapshot.val());
});

sendBtn.addEventListener('click', () => {
  const text = msgInput.value.trim();
  if (text) {
    push(messagesRef, {
      sender: username,
      type: 'text',
      content: text,
      timestamp: Date.now(),
    });
    msgInput.value = '';
  }
});

uploadBtn.addEventListener('click', async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.click();

  input.onchange = async () => {
    const file = input.files[0];
    if (file) {
      const storageRef = sRef(storage, `rooms/${roomId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      push(messagesRef, {
        sender: username,
        type: 'image',
        content: url,
        timestamp: Date.now(),
      });
    }
  };
});

leaveRoomBtn.addEventListener('click', () => {
  localStorage.removeItem('username');
  localStorage.removeItem('roomId');
  window.location.href = 'login.html';
});

window.addEventListener('beforeunload', () => {
  set(ref(db, `rooms/${roomId}/users/${username}`), null);
});

