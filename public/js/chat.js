// public/js/chat.js

// Import Firebase services and functions
import { db, storage } from './firebase-init.js'; // Ensure storage is imported
import { ref, push, set, onValue, off, serverTimestamp, get, onDisconnect, child, update as rtdbUpdate } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { uploadBytesResumable, getDownloadURL, ref as storageRef } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';


// Get DOM elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const roomDisplayName = document.getElementById('roomDisplayName');
const connectedUsersCount = document.getElementById('connectedUsersCount');
const imageUpload = document.getElementById('imageUpload');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

// Retrieve room and user info from sessionStorage
const roomCode = sessionStorage.getItem('parichat_roomCode');
const userName = sessionStorage.getItem('parichat_userName');
const userId = sessionStorage.getItem('parichat_userId');

// Firebase Realtime Database references
const roomRef = ref(db, `rooms/${roomCode}`);
const messagesRef = child(roomRef, 'messages');
const usersInRoomRef = child(roomRef, 'users');
const currentUserPresenceRef = child(usersInRoomRef, userId);


// --- UI Helper Functions ---

// Function to generate avatar initials
function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

// Function to format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Function to scroll chat to the bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Function to display messages in the chat UI
function displayMessage(senderId, senderName, messageText, timestamp, messageType = 'text', imageUrl = null) {
    const isSent = senderId === userId; // Determine if message was sent by current user
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble');
    messageBubble.classList.add(isSent ? 'sent' : 'received');

    const avatar = document.createElement('div');
    avatar.classList.add('message-avatar');
    avatar.textContent = getInitials(senderName);

    const content = document.createElement('div');
    content.classList.add('message-content');

    if (messageType === 'text') {
        const paragraph = document.createElement('p');
        paragraph.textContent = messageText;
        content.appendChild(paragraph);
    } else if (messageType === 'image' && imageUrl) {
        const imageElement = document.createElement('img');
        imageElement.src = imageUrl;
        imageElement.alt = "Shared Image";
        imageElement.classList.add('chat-image');
        content.appendChild(imageElement);
        // Optional: Add a caption if messageText is available for images
        if (messageText) {
            const caption = document.createElement('p');
            caption.textContent = messageText;
            caption.classList.add('image-caption');
            content.appendChild(caption);
        }
    }

    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('message-timestamp');
    timestampSpan.textContent = formatTimestamp(timestamp);
    content.appendChild(timestampSpan);

    if (isSent) {
        messageBubble.appendChild(content);
        messageBubble.appendChild(avatar);
    } else {
        messageBubble.appendChild(avatar);
        messageBubble.appendChild(content);
    }

    chatMessages.appendChild(messageBubble);
    scrollToBottom();
}

// Function to display system messages (join/leave)
function displaySystemMessage(message) {
    const systemMessage = document.createElement('div');
    systemMessage.classList.add('system-message');
    systemMessage.textContent = message;
    chatMessages.appendChild(systemMessage);
    scrollToBottom();
}

// Function to handle custom modal messages (re-used from auth.js concept)
function showAppMessage(title, message, isError = false) {
    const modal = document.createElement('div');
    modal.classList.add('app-modal');
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-button">&times;</span>
            <h2>${title}</h2>
            <p>${message}</p>
        </div>
    `;
    if (isError) {
        modal.querySelector('h2').style.color = '#D93025';
    } else {
        modal.querySelector('h2').style.color = '#1A73E8';
    }
    document.body.appendChild(modal);

    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background-color: rgba(0,0,0,0.5); display: flex;
        justify-content: center; align-items: center; z-index: 1000;
    `;
    modal.querySelector('.modal-content').style.cssText = `
        background-color: white; padding: 25px; border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3); text-align: center;
        max-width: 400px; width: 90%; position: relative;
    `;
    modal.querySelector('.close-button').style.cssText = `
        position: absolute; top: 10px; right: 15px; font-size: 24px;
        cursor: pointer;
    `;
    modal.querySelector('.close-button').onclick = () => { document.body.removeChild(modal); };
    modal.onclick = (event) => { if (event.target === modal) { document.body.removeChild(modal); } };
}


// --- Main Chat Logic ---

// Function to send a message
async function sendMessage() {
    const messageText = messageInput.value.trim();
    if (messageText === '') return;

    // Create message object
    const message = {
        senderId: userId,
        senderName: userName,
        text: messageText,
        timestamp: serverTimestamp(), // Firebase server timestamp
        type: 'text'
    };

    try {
        await push(messagesRef, message); // Push message to Firebase
        messageInput.value = ''; // Clear input field
        updateTypingStatus(false); // Clear typing status after sending message
    } catch (error) {
        console.error("Error sending message:", error);
        showAppMessage("Message Error", "Failed to send message. Please try again.", true);
    }
}

// Function to send an image
async function sendImage(file) {
    if (!file) return;

    // Display a "Sending image..." message or loader
    showAppMessage("Uploading Image", "Your image is being uploaded...", false);

    const fileName = `${userId}_${Date.now()}_${file.name}`;
    const imagePath = `chat_images/${roomCode}/${fileName}`;
    const imageRef = storageRef(storage, imagePath);

    try {
        const uploadTask = uploadBytesResumable(imageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                // Observe state change events such as progress, pause, and resume
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                // You could update a progress bar here
                console.log('Upload is ' + progress + '% done');
            },
            (error) => {
                // Handle unsuccessful uploads
                console.error("Image upload error:", error);
                document.querySelector('.app-modal')?.remove(); // Close previous modal
                showAppMessage("Upload Failed", `Failed to upload image: ${error.message}`, true);
            },
            () => {
                // Handle successful uploads on complete
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    console.log('File available at', downloadURL);
                    // Create message object with image URL
                    const message = {
                        senderId: userId,
                        senderName: userName,
                        text: messageInput.value.trim(), // Optional caption
                        timestamp: serverTimestamp(),
                        type: 'image',
                        imageUrl: downloadURL
                    };
                    push(messagesRef, message); // Push image message to Firebase
                    messageInput.value = ''; // Clear input field
                    updateTypingStatus(false); // Clear typing status
                    document.querySelector('.app-modal')?.remove(); // Close upload modal
                });
            }
        );
    } catch (error) {
        console.error("Error initiating image upload:", error);
        document.querySelector('.app-modal')?.remove();
        showAppMessage("Upload Error", `Could not initiate image upload: ${error.message}`, true);
    }
}


// --- Typing Indicator Logic ---

// Reference for user's typing status
const myTypingStatusRef = child(currentUserPresenceRef, 'isTyping');
const remoteTypingStatusRef = (otherUserId) => child(child(usersInRoomRef, otherUserId), 'isTyping');

let typingTimeout;
const TYPING_TIMEOUT_MS = 1500; // 1.5 seconds

function updateTypingStatus(isTyping) {
    set(myTypingStatusRef, isTyping)
        .catch(error => console.error("Error updating typing status:", error));
}

// Listen for typing events
messageInput.addEventListener('input', () => {
    updateTypingStatus(true); // Set my status to typing

    clearTimeout(typingTimeout); // Clear previous timeout
    typingTimeout = setTimeout(() => {
        updateTypingStatus(false); // Set my status to not typing after timeout
    }, TYPING_TIMEOUT_MS);
});


let remoteTypingListeners = {};
function setupRemoteTypingListeners(users) {
    // Clear old listeners
    for (const id in remoteTypingListeners) {
        off(remoteTypingStatusRef(id), remoteTypingListeners[id]);
        delete remoteTypingListeners[id];
    }

    // Set up new listeners for other users
    Object.keys(users).forEach(id => {
        if (id !== userId) { // Don't listen to my own typing status
            const listener = onValue(remoteTypingStatusRef(id), (snapshot) => {
                const isTyping = snapshot.val();
                const typingIndicatorId = `typing-indicator-${id}`;
                let typingIndicator = document.getElementById(typingIndicatorId);

                if (isTyping) {
                    if (!typingIndicator) {
                        // Create and append typing indicator
                        typingIndicator = document.createElement('div');
                        typingIndicator.id = typingIndicatorId;
                        typingIndicator.classList.add('typing-indicator', 'received');
                        typingIndicator.innerHTML = `
                            <div class="message-avatar">${getInitials(users[id].userName)}</div>
                            <div class="message-content"><p>Typing...</p></div>
                        `;
                        chatMessages.appendChild(typingIndicator);
                        scrollToBottom();
                    }
                } else {
                    if (typingIndicator) {
                        typingIndicator.remove(); // Remove indicator when not typing
                    }
                }
                scrollToBottom(); // Always scroll to bottom on status change
            });
            remoteTypingListeners[id] = listener; // Store listener to detach later
        }
    });
}


// --- Initial Load & Real-time Listeners ---

// VALIDATE SESSION AND REDIRECT IF INVALID
// This is critical to ensure the user is actively in the room when chat.html loads.
async function validateSessionAndRedirect() {
    if (!roomCode || !userName || !userId) {
        console.warn("Missing session data. Redirecting to login.");
        sessionStorage.clear(); // Ensure clean slate
        window.location.href = 'index.html';
        return false;
    }

    try {
        // --- FORCE A CLEAN PRESENCE STATE ON RELOAD ---
        // 1. Immediately clear the current user's presence from Firebase.
        //    This effectively ends any previous session's online status or pending onDisconnect.
        await set(currentUserPresenceRef, null);
        // 2. Clear any onDisconnect actions that might have been set from previous session
        //    for the current user's node. This prevents stale onDisconnects from running.
        await onDisconnect(currentUserPresenceRef).cancel(); // Ensure previous onDisconnects are cleared.
        await onDisconnect(myTypingStatusRef).cancel(); // Clear typing onDisconnect too.

        // 3. Now, set the new online status for this session, with new onDisconnect handlers.
        await rtdbUpdate(currentUserPresenceRef, {
            userName: userName,
            status: 'online', // Explicitly set to online for this fresh session
            lastOnline: Date.now()
        });
        onDisconnect(currentUserPresenceRef).update({ status: 'offline', lastOnline: serverTimestamp() });
        onDisconnect(myTypingStatusRef).set(false);

        // --- Final verification after re-establishing presence ---
        const userSnapshot = await get(currentUserPresenceRef);
        // Check if the user record exists and matches our session data (userName)
        // and importantly, if its status is 'online' as set by *this* session.
        if (!userSnapshot.exists() || userSnapshot.val().userName !== userName || userSnapshot.val().status !== 'online') {
            console.warn("User data not found, mismatched, or not online after re-establishing presence. Redirecting to login.");
            sessionStorage.clear(); // Clear potentially stale session data
            window.location.href = 'index.html';
            return false;
        }

        console.log("Session valid. User is in room and presence re-established.");
        return true; // Session is valid
    } catch (error) {
        console.error("Error validating session or re-establishing presence:", error);
        // If there's any Firebase error (e.g., network, permission), assume invalid session.
        sessionStorage.clear();
        window.location.href = 'index.html';
        return false;
    }
}

// Function to set up all real-time listeners after session validation
async function setupRealtimeListeners() {
    // Check if session is valid before setting up listeners
    const isValidSession = await validateSessionAndRedirect();
    if (!isValidSession) {
        return; // Stop if session is not valid (already redirected)
    }

    // Display room code in the header
    roomDisplayName.textContent = `Room: ${roomCode}`;

    // Listen for new messages
    onValue(messagesRef, (snapshot) => {
        chatMessages.innerHTML = ''; // Clear existing messages before re-rendering
        snapshot.forEach((childSnapshot) => {
            const message = childSnapshot.val();
            displayMessage(message.senderId, message.senderName, message.text, message.timestamp, message.type, message.imageUrl);
        });
    });

    // Listen for user presence changes
    onValue(usersInRoomRef, (snapshot) => {
        const users = snapshot.val();
        let connectedCount = 0;
        let otherUser = null;

        if (users) {
            Object.keys(users).forEach(id => {
                if (users[id].status === 'online') {
                    connectedCount++;
                }
                if (id !== userId) { // Store reference to other user for typing indicator
                    otherUser = users[id];
                }
            });
        }
        connectedUsersCount.textContent = connectedCount;

        // Setup/update remote typing listeners based on current users
        setupRemoteTypingListeners(users);
    });

    // Initial setup of typing status to false for current user (will be set again by validateSessionAndRedirect)
    // updateTypingStatus(false); // No longer strictly needed here due to validateSessionAndRedirect handling it
}

// Event listeners
sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        sendImage(file);
    }
});

leaveRoomBtn.addEventListener('click', () => {
    // Clear user's presence from Firebase immediately
    remove(currentUserPresenceRef)
        .then(() => {
            console.log('User presence removed from Firebase.');
            sessionStorage.clear(); // Clear session data
            window.location.href = 'index.html'; // Redirect to login page
        })
        .catch(error => {
            console.error('Error removing user presence:', error);
            showAppMessage("Error Leaving Room", "Could not leave room cleanly. Please try refreshing.", true);
        });
});


// Call this function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', setupRealtimeListeners);
