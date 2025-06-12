// public/js/chat.js

// Import Firebase services and necessary functions
import { auth, db, storage } from './firebase-init.js';
import { ref, push, set, onValue, off, serverTimestamp, get, remove } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { uploadBytesResumable, getDownloadURL, ref as storageRef } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// Get DOM elements
const roomDisplayName = document.getElementById('roomDisplayName');
const connectedUsersCount = document.getElementById('connectedUsersCount');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const imageUploadInput = document.getElementById('imageUpload');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const videoCallBtn = document.getElementById('videoCallBtn'); // Will be used by videoCall.js

// Retrieve user and room info from sessionStorage
const roomCode = sessionStorage.getItem('parichat_roomCode');
const userName = sessionStorage.getItem('parichat_userName');
const userId = sessionStorage.getItem('parichat_userId');

// Redirect to login if essential info is missing
if (!roomCode || !userName || !userId) {
    alert("Room information missing. Please join a room first."); // Using alert here for critical redirection
    window.location.href = 'index.html';
}

// Display room info in header
roomDisplayName.textContent = `Room ${roomCode}`;

// Firebase Realtime Database references
const roomRef = ref(db, `rooms/${roomCode}`);
const messagesRef = ref(db, `rooms/${roomCode}/messages`);
const usersRef = ref(db, `rooms/${roomCode}/users`);
const typingStatusRef = ref(db, `rooms/${roomCode}/typing/${userId}`); // Current user's typing status
const allTypingStatusRef = ref(db, `rooms/${roomCode}/typing`); // All typing statuses

let isTyping = false; // To manage typing status
let typingTimeout; // To clear typing status after a delay

// --- Utility Functions ---

// Function to format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Function to get user initial for avatar
function getUserInitial(name) {
    return name ? name.charAt(0).toUpperCase() : 'U';
}

// Function to scroll chat messages to the bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Function to display messages in the chat UI
function displayMessage(messageData, isOwnMessage) {
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble');
    messageBubble.classList.add(isOwnMessage ? 'sent' : 'received');

    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');

    // Add avatar for received messages, or sent messages if desired
    if (!isOwnMessage) {
        const messageAvatar = document.createElement('div');
        messageAvatar.classList.add('message-avatar');
        messageAvatar.textContent = getUserInitial(messageData.userName);
        messageBubble.appendChild(messageAvatar);
    }

    if (messageData.text) {
        const p = document.createElement('p');
        p.textContent = messageData.text;
        messageContent.appendChild(p);
    } else if (messageData.imageUrl) {
        const img = document.createElement('img');
        img.src = messageData.imageUrl;
        img.alt = "Sent image";
        img.style.maxWidth = '100%'; // Ensure image fits in bubble
        img.style.borderRadius = '8px'; // Rounded corners for images
        messageContent.appendChild(img);
    }

    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('message-timestamp');
    timestampSpan.textContent = formatTimestamp(messageData.timestamp);
    messageContent.appendChild(timestampSpan);

    messageBubble.appendChild(messageContent);

    // Add avatar for sent messages on the right
    if (isOwnMessage) {
        const messageAvatar = document.createElement('div');
        messageAvatar.classList.add('message-avatar');
        messageAvatar.textContent = getUserInitial(messageData.userName);
        messageBubble.appendChild(messageAvatar);
    }

    chatMessages.appendChild(messageBubble);
    scrollToBottom();
}

// Function to display system messages (join/leave)
function displaySystemMessage(message) {
    const systemMessageDiv = document.createElement('div');
    systemMessageDiv.classList.add('system-message');
    systemMessageDiv.textContent = message;
    chatMessages.appendChild(systemMessageDiv);
    scrollToBottom();
}

// --- Firebase Listeners ---

// Listen for messages
onValue(messagesRef, (snapshot) => {
    chatMessages.innerHTML = ''; // Clear existing messages
    const messages = snapshot.val();
    if (messages) {
        const sortedMessages = Object.values(messages).sort((a, b) => a.timestamp - b.timestamp);
        sortedMessages.forEach(msg => {
            // Check if message is valid (not undefined or null)
            if (msg) {
                displayMessage(msg, msg.userId === userId);
            }
        });
    }
});

// Listen for user presence in the room
onValue(usersRef, (snapshot) => {
    const users = snapshot.val();
    let currentUsers = [];
    if (users) {
        currentUsers = Object.values(users);
        // Update connected users count
        connectedUsersCount.textContent = currentUsers.length;

        // Display join/leave system messages (simple approach for now)
        // This is a basic implementation; more robust tracking would involve
        // storing a 'lastSeen' timestamp and comparing.
        const previousUsernames = new Set(JSON.parse(sessionStorage.getItem('parichat_previousUsernames') || '[]'));
        const currentUsernames = new Set(currentUsers.map(u => u.userName));

        // Check for new joins
        currentUsers.forEach(user => {
            if (!previousUsernames.has(user.userName) && user.userId !== userId) {
                displaySystemMessage(`${user.userName} Joined`);
            }
        });

        // Check for leaves (This can be tricky with simple onValue, onDisconnect is better for actual leaving)
        // For reload case, onDisconnect takes care of it, but for explicit leave, we handle it.
        previousUsernames.forEach(pUserName => {
            if (!currentUsernames.has(pUserName) && pUserName !== userName) { // Don't show "you left"
                // Only show if the user isn't the current user who just joined/reloaded
                if (!currentUsers.some(u => u.userName === pUserName && u.userId === userId)) {
                     // Check if this is not the current user who just rejoined
                    displaySystemMessage(`${pUserName} Left`);
                }
            }
        });

        sessionStorage.setItem('parichat_previousUsernames', JSON.stringify(Array.from(currentUsernames)));
    } else {
        connectedUsersCount.textContent = 0;
        // If room is empty, user might have left. If current user is still here, display
        // a message or handle redirection. For now, onDisconnect in auth.js handles this.
    }
});

// Typing indicator display
let typingIndicatorElement = null; // Store reference to typing indicator
onValue(allTypingStatusRef, (snapshot) => {
    const typingUsers = snapshot.val();
    const otherTypingUsers = [];

    // Filter out current user's typing status
    if (typingUsers) {
        for (const id in typingUsers) {
            if (id !== userId && typingUsers[id].isTyping) {
                // Find the username associated with this typing userId
                get(child(usersRef, id)).then((userSnapshot) => {
                    const typingUserName = userSnapshot.val()?.userName;
                    if (typingUserName) {
                        otherTypingUsers.push(typingUserName);
                    }
                });
            }
        }
    }

    // Debounce the update to avoid flickering
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        if (otherTypingUsers.length > 0) {
            if (!typingIndicatorElement) {
                typingIndicatorElement = document.createElement('div');
                typingIndicatorElement.classList.add('typing-indicator', 'received');
                typingIndicatorElement.innerHTML = `
                    <div class="message-avatar">${getUserInitial(otherTypingUsers[0])}</div>
                    <div class="message-content">
                        <p>Typing...</p>
                    </div>
                `;
                chatMessages.appendChild(typingIndicatorElement);
            }
            // Update avatar if multiple users are typing (simple: just show one's initial)
            typingIndicatorElement.querySelector('.message-avatar').textContent = getUserInitial(otherTypingUsers[0]);
            typingIndicatorElement.style.display = 'flex';
        } else {
            if (typingIndicatorElement) {
                typingIndicatorElement.style.display = 'none';
            }
        }
        scrollToBottom();
    }, 200); // Small debounce to prevent rapid changes
});


// --- Event Listeners ---

// Send Message (Text)
sendMessageBtn.addEventListener('click', async () => {
    const messageText = messageInput.value.trim();
    if (messageText) {
        await sendMessage({
            type: 'text',
            text: messageText
        });
        messageInput.value = ''; // Clear input
        updateTypingStatus(false); // Stop typing after sending message
    }
});

// Send message on Enter key press
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessageBtn.click(); // Trigger send button click
    }
});

// Handle typing status
messageInput.addEventListener('input', () => {
    if (!isTyping) {
        isTyping = true;
        updateTypingStatus(true);
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        isTyping = false;
        updateTypingStatus(false);
    }, 3000); // Stop typing after 3 seconds of inactivity
});

// Send Message (Image)
imageUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        await sendImage(file);
    }
    e.target.value = ''; // Clear the input field to allow re-uploading the same file
});

// Leave Room Button
leaveRoomBtn.addEventListener('click', async () => {
    // Remove user's presence from Firebase
    await remove(ref(db, `rooms/${roomCode}/users/${userId}`));
    // Clear session storage
    sessionStorage.removeItem('parichat_roomCode');
    sessionStorage.removeItem('parichat_userName');
    sessionStorage.removeItem('parichat_userId');
    sessionStorage.removeItem('parichat_previousUsernames');

    // Redirect to login page
    window.location.href = 'index.html';
});

// --- Firebase Write Functions ---

async function sendMessage(messageData) {
    try {
        await push(messagesRef, {
            ...messageData,
            userName: userName,
            userId: userId,
            timestamp: serverTimestamp() // Firebase server timestamp
        });
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Failed to send message."); // Fallback for critical errors
    }
}

async function sendImage(file) {
    try {
        const imageId = push(messagesRef).key; // Get a unique ID for the image message
        const imageStorageRef = storageRef(storage, `chat_images/${roomCode}/${imageId}_${file.name}`);

        // Upload image to Firebase Storage
        const uploadTask = uploadBytesResumable(imageStorageRef, file);

        // Track upload progress if needed (optional)
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + progress + '% done');
                // You could update a UI progress bar here
            },
            (error) => {
                console.error("Image upload error:", error);
                alert("Failed to upload image.");
            },
            async () => {
                // Get download URL after successful upload
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                // Send message with image URL
                await sendMessage({
                    type: 'image',
                    imageUrl: downloadURL
                });
                console.log('Image uploaded and message sent with URL:', downloadURL);
            }
        );
    } catch (error) {
        console.error("Error sending image:", error);
        alert("Failed to send image.");
    }
}

async function updateTypingStatus(isTyping) {
    try {
        await set(typingStatusRef, { isTyping: isTyping, userName: userName });
        // Set onDisconnect for typing status too, just in case
        if (isTyping) {
            onDisconnect(typingStatusRef).remove();
        }
    } catch (error) {
        console.error("Error updating typing status:", error);
    }
}

// Initial update of typing status to false when page loads/reloads
updateTypingStatus(false);
