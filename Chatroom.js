// chatroom.js
import {
  db,
  ref,
  push,
  onChildAdded,
  remove,
  set,
  onDisconnect,
  onValue
} from './firebase.js';

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
let username = urlParams.get('user');

const chatBox = document.getElementById('chatBox');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const uploadBtn = document.getElementById('uploadBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const startCallBtn = document.getElementById('startCallBtn');

const roomRef = ref(db, `rooms/${roomId}`);
const messagesRef = ref(db, `rooms/${roomId}/messages`);
const presenceRef = ref(db, `rooms/${roomId}/presence/${username}`);

// Handle presence
set(presenceRef, true);
onDisconnect(presenceRef).remove();

onValue(ref(db, `rooms/${roomId}/presence`), (snapshot) => {
  const users = snapshot.val();
  if (users && Object.keys(users).length > 2) {
    alert('Room is full!');
    window.location.href = 'index.html';
  }
});

// Send Text Message
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

// Listen for messages
onChildAdded(messagesRef, (data) => {
  const msg = data.val();
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = `
    <p>${msg.content}</p>
    <small>${msg.sender}<br>${new Date(msg.timestamp).toLocaleTimeString()}</small>
  `;
  chatBox.appendChild(bubble);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Upload Image
uploadBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      push(messagesRef, {
        sender: username,
        type: 'image',
        content: reader.result,
        timestamp: Date.now(),
      });
    };
    reader.readAsDataURL(file);
  };
  input.click();
});

// Leave Room
leaveRoomBtn.addEventListener('click', () => {
  remove(presenceRef);
  window.location.href = 'index.html';
});

// Start Call
startCallBtn.addEventListener('click', () => {
  window.location.href = `videocall.html?room=${roomId}&user=${username}`;
});

// Exit cleanup
window.addEventListener('beforeunload', () => {
  remove(presenceRef);
});
