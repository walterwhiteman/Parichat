// public/js/videoCall.js

// Import Firebase services
import { db } from './firebase-init.js';
import { ref, set, onValue, off, remove, get, child } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

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
let currentCall = null;
let isMicMuted = false;
let isCamOff = false;
let callTimerInterval = null;
let callStartTime = 0;

// Firebase Realtime Database references for signaling
const callRef = ref(db, `rooms/${roomCode}/calls`); // Parent node for all calls in this room
const myCallSignalRef = ref(db, `rooms/${roomCode}/calls/${userId}`); // My outgoing/incoming call signal
const peerCallSignalRef = (peerId) => ref(db, `rooms/${roomCode}/calls/${peerId}`); // Other user's call signal

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
        localVideo.play();
        makeDraggable(localVideo); // Make PIP draggable
    } catch (err) {
        console.error("Error accessing media devices:", err);
        showAppMessage("Media Access Denied", "Please allow camera and microphone access to make video calls.", true);
        localStream = null;
    }
}

// Initialize PeerJS
async function initializePeer() {
    if (!peer) {
        peer = new Peer(userId, {
            host: 'peerjs-server.herokuapp.com', // Free public PeerJS server
            port: 443,
            secure: true,
            path: '/'
        });

        peer.on('open', (id) => {
            console.log('My PeerJS ID:', id);
            // Ensure my PeerJS ID is published or known to others
            set(ref(db, `rooms/${roomCode}/users/${userId}/peerId`), id);
            onDisconnect(ref(db, `rooms/${roomCode}/users/${userId}/peerId`)).remove();
        });

        peer.on('call', (call) => {
            console.log('Incoming call from:', call.peer);
            // Ensure we don't accept multiple calls or from unintended users
            if (currentCall && currentCall.open) {
                console.warn('Already in a call, rejecting new incoming call.');
                call.close();
                return;
            }

            // Check if the caller is the other user in the 2-person room
            get(ref(db, `rooms/${roomCode}/users`)).then(snapshot => {
                const users = snapshot.val();
                const otherUser = Object.values(users).find(u => u.peerId === call.peer && u.userId !== userId);
                if (otherUser) {
                    incomingCallModal.classList.add('active');
                    currentCall = call; // Store the call object temporarily
                } else {
                    console.warn('Call from unknown peer or more than 2 users, rejecting.');
                    call.close();
                }
            });
        });

        peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            showAppMessage("PeerJS Error", `A WebRTC error occurred: ${err.message}`, true);
            endCall(); // Attempt to end any active call on error
        });
    }
}

// Answer incoming call
acceptCallBtn.addEventListener('click', async () => {
    if (!currentCall) return;

    if (!localStream) {
        await getLocalStream();
        if (!localStream) {
            showAppMessage("Media Error", "Cannot accept call: Camera/Mic access denied.", true);
            return;
        }
    }
    
    incomingCallModal.classList.remove('active');
    activeCallView.classList.add('active');
    startCallTimer();

    currentCall.answer(localStream); // Answer the call with local stream
    currentCall.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        remoteVideo.play();
    });
    currentCall.on('close', () => {
        console.log('Call ended by peer.');
        endCall();
    });
    currentCall.on('error', (err) => {
        console.error('Call error:', err);
        showAppMessage("Call Error", `Call disconnected: ${err.message}`, true);
        endCall();
    });

    // Notify other user that call is accepted (via Firebase signaling)
    const otherPeerId = currentCall.peer;
    set(peerCallSignalRef(otherPeerId), { status: 'accepted', by: userId });
});

// Reject incoming call
rejectCallBtn.addEventListener('click', () => {
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
    incomingCallModal.classList.remove('active');
    // Notify caller that call is rejected
    set(myCallSignalRef, { status: 'rejected', by: userId });
});

// Initiate Outgoing Call
videoCallBtn.addEventListener('click', async () => {
    if (currentCall && currentCall.open) {
        showAppMessage("Active Call", "You are already in a call.", false);
        return;
    }
    if (!localStream) {
        await getLocalStream();
        if (!localStream) return; // If stream not obtained, don't proceed
    }

    // Find the other user's PeerID in the room
    const snapshot = await get(ref(db, `rooms/${roomCode}/users`));
    const users = snapshot.val();
    let otherPeerId = null;
    let otherUserId = null;

    if (users) {
        // Find the peerId of the other user in a 2-person room
        for (const id in users) {
            if (id !== userId && users[id].peerId) {
                otherPeerId = users[id].peerId;
                otherUserId = id;
                break;
            }
        }
    }

    if (!otherPeerId) {
        showAppMessage("No Partner", "No other user found in this room to call.", true);
        return;
    }

    // Indicate that we are calling
    showAppMessage("Calling...", `Calling ${users[otherUserId].userName}...`);
    set(myCallSignalRef, { status: 'calling', to: otherUserId, from: userId, callerPeerId: peer.id });

    // Make the PeerJS call
    const call = peer.call(otherPeerId, localStream);
    currentCall = call;

    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        remoteVideo.play();
        activeCallView.classList.add('active'); // Show active call view
        startCallTimer();
        document.querySelector('.app-modal')?.remove(); // Close "Calling..." modal
    });
    call.on('close', () => {
        console.log('Call ended.');
        endCall();
    });
    call.on('error', (err) => {
        console.error('Call error:', err);
        showAppMessage("Call Error", `Call disconnected: ${err.message}`, true);
        endCall();
    });

    // Listen for peer's response to our call signal
    onValue(peerCallSignalRef(otherUserId), (snapshot) => {
        const signal = snapshot.val();
        if (signal && signal.status === 'accepted' && signal.by === otherUserId && currentCall && currentCall.peer === otherPeerId) {
            console.log('Call accepted by peer.');
            document.querySelector('.app-modal')?.remove(); // Close "Calling..." modal
        } else if (signal && signal.status === 'rejected' && signal.by === otherUserId && currentCall && currentCall.peer === otherPeerId) {
            console.log('Call rejected by peer.');
            showAppMessage("Call Rejected", `${users[otherUserId].userName} rejected your call.`, true);
            endCall();
        } else if (signal === null && currentCall && currentCall.peer === otherPeerId) {
            // Other user's call signal was removed, likely they left or disconnected
            console.log('Other user disconnected during call setup.');
            showAppMessage("User Disconnected", `${users[otherUserId].userName} disconnected.`, true);
            endCall();
        }
    });
});

// Toggle Microphone
toggleMicBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
            isMicMuted = !track.enabled;
            toggleMicBtn.querySelector('.material-symbols-outlined').textContent = isMicMuted ? 'mic_off' : 'mic';
            console.log('Mic ' + (isMicMuted ? 'muted' : 'unmuted'));
        });
    }
});

// Toggle Camera
toggleCamBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getVideoTracks().forEach(track => {
            track.enabled = !track.enabled;
            isCamOff = !track.enabled;
            toggleCamBtn.querySelector('.material-symbols-outlined').textContent = isCamOff ? 'videocam_off' : 'videocam';
            console.log('Cam ' + (isCamOff ? 'off' : 'on'));
        });
    }
});

// End Call
endCallBtn.addEventListener('click', () => {
    endCall();
});

function endCall() {
    if (currentCall) {
        currentCall.close(); // Close the PeerJS call
        currentCall = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop()); // Stop local media tracks
        localStream = null;
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    activeCallView.classList.remove('active');
    incomingCallModal.classList.remove('active');
    stopCallTimer();
    isMicMuted = false;
    isCamOff = false;
    toggleMicBtn.querySelector('.material-symbols-outlined').textContent = 'mic';
    toggleCamBtn.querySelector('.material-symbols-outlined').textContent = 'videocam';

    // Clear call signal from Firebase
    remove(myCallSignalRef).catch(e => console.error("Error clearing my call signal:", e));
}


// --- Initial Setup / Listeners ---

// Listen for incoming call signals (general listener for this user's node)
onValue(myCallSignalRef, async (snapshot) => {
    const callSignal = snapshot.val();
    if (callSignal && callSignal.status === 'calling' && callSignal.to === userId && !currentCall) {
        // This means someone is calling me
        // Get media stream before showing modal to speed up acceptance
        if (!localStream) {
            await getLocalStream();
            if (!localStream) { // If stream access failed, auto-reject
                remove(myCallSignalRef); // Clear incoming signal
                return;
            }
        }
        incomingCallModal.classList.add('active');
    } else if (callSignal === null && currentCall) {
        // My call signal was removed by other peer (e.g., they ended it)
        console.log('My call signal removed from Firebase, likely peer ended.');
        endCall();
    }
});

// Initialize PeerJS when the page loads, but only if user info is available
if (roomCode && userName && userId) {
    initializePeer();
    // Pre-fetch local stream when chat page loads (optional, but speeds up call start)
    // You might want to defer this until the user clicks the video call button if privacy is a top concern on load.
    // getLocalStream(); // Commenting out for now, to ensure mic/cam prompt is only on button click.
}


