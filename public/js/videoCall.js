// public/js/videoCall.js

// Import Firebase services and necessary functions
import { db } from './firebase-init.js';
import { ref, set, onValue, off, remove, get, child, onDisconnect } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

// Get DOM elements for video call UI
const videoCallBtn = document.getElementById('videoCallBtn');
const incomingCallModal = document.getElementById('incomingCallModal');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const rejectCallBtn = document.getElementById('rejectCallBtn');
const activeCallView = document.getElementById('activeCallView');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const toggleMicBtn = document.getElementById('toggleMicBtn');
const toggleCamBtn = document.getElementById('toggleCamBtn');
const endCallBtn = document.getElementById('endCallBtn');
const callTimerDisplay = document.getElementById('callTimer');

// Retrieve room and user info from sessionStorage
const roomCode = sessionStorage.getItem('parichat_roomCode');
const userName = sessionStorage.getItem('parichat_userName');
const userId = sessionStorage.getItem('parichat_userId');

// --- WebRTC / PeerJS variables ---
let peer = null;
let localStream = null;
let currentCall = null; // Stores the active PeerJS call object
let isMicMuted = false;
let isCamOff = false;
let callTimerInterval = null;
let callStartTime = 0;
let callTimeoutTimer = null; // Timer for outgoing call unanswered
let peerCallStateListener = null; // To store listener for remote call state

// Firebase Realtime Database references for signaling
const usersInRoomRef = ref(db, `rooms/${roomCode}/users`); // All users in the room
const myUserRef = child(usersInRoomRef, userId); // My user node
const myPeerIdRef = child(myUserRef, 'peerId'); // My PeerJS ID
const myCallStateRef = child(myUserRef, 'callState'); // My current call state
const remoteUserRef = (remoteUserId) => child(usersInRoomRef, remoteUserId); // Other user's node
const remotePeerIdRef = (remoteUserId) => child(remoteUserRef(remoteUserId), 'peerId'); // Other user's PeerJS ID
const remoteCallStateRef = (remoteUserId) => child(remoteUserRef(remoteUserId), 'callState'); // Other user's call state

// --- Utility Functions ---

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
        modal.querySelector('h2').style.color = '#D93025'; // Red for errors
    } else {
        modal.querySelector('h2').style.color = '#1A73E8'; // Blue for info
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

// Draggable PIP video
function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    element.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // Get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // Call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // Calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // Set the element's new position:
        let newTop = (element.offsetTop - pos2);
        let newLeft = (element.offsetLeft - pos1);

        // Boundary checks
        const container = document.body; // Or a specific container for the video
        newTop = Math.max(0, Math.min(newTop, container.clientHeight - element.offsetHeight));
        newLeft = Math.max(0, Math.min(newLeft, container.clientWidth - element.offsetWidth));

        element.style.top = newTop + "px";
        element.style.left = newLeft + "px";
    }

    function closeDragElement() {
        // Stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
    }
}


// --- Call Management Functions ---

// Start call timer
function startCallTimer() {
    callStartTime = Date.now();
    callTimerInterval = setInterval(() => {
        const elapsedTime = Date.now() - callStartTime;
        const minutes = Math.floor(elapsedTime / 60000);
        const seconds = Math.floor((elapsedTime % 60000) / 1000);
        callTimerDisplay.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// Stop call timer
function stopCallTimer() {
    clearInterval(callTimerInterval);
    callTimerDisplay.textContent = '00:00';
}

// Get local media stream (camera and mic)
async function getLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        // Explicitly try to play, catching AbortError if it happens
        try {
            await localVideo.play();
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error("Error playing local video:", e);
            }
            // else, it's an AbortError, which is often benign and can be ignored.
        }
        makeDraggable(localVideo); // Make PIP draggable
        return localStream;
    } catch (err) {
        console.error("Error accessing media devices:", err);
        showAppMessage("Media Access Denied", "Please allow camera and microphone access to make video calls.", true);
        localStream = null;
        return null;
    }
}

// Initialize PeerJS
async function initializePeer() {
    if (!peer) {
        // Configure PeerJS with STUN/TURN servers for better NAT traversal
        // STUN servers help find public IPs. TURN servers relay traffic if direct connection fails.
        // Public TURN servers can be unreliable or rate-limited. For production, host your own.
        peer = new Peer(userId, {
            host: '0.peerjs.com', // PeerJS Cloud host
            port: 443,
            secure: true,
            path: '/',
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    // Public TURN server (numb.viagenie.ca - often used for testing)
                    // Note: This service might not be always available or might have rate limits.
                    // Replace with your own TURN server if you have one for better reliability.
                    { urls: 'turn:numb.viagenie.ca', username: 'webrtc@live.com', credential: 'muazkh' }
                ]
            }
        });

        peer.on('open', async (id) => {
            console.log('My PeerJS ID:', id);
            // Ensure my PeerJS ID is published and set onDisconnect
            await set(myPeerIdRef, id); // Set first
            onDisconnect(myPeerIdRef).remove(); // Then set onDisconnect
            onDisconnect(myCallStateRef).set(null); // Also set my callState to null on disconnect

            // Listen for incoming call signals on my own callState node
            onValue(myCallStateRef, async (snapshot) => {
                const callState = snapshot.val();
                if (callState && callState.status === 'incoming' && callState.from && callState.callerPee
