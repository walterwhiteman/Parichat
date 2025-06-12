// public/js/auth.js

// Import Firebase services from firebase-init.js
import { auth, db } from './firebase-init.js';
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { ref, get, set, update, onDisconnect, push, child } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

// Get DOM elements
const loginForm = document.getElementById('loginForm');
const roomCodeInput = document.getElementById('roomCode');
const userNameInput = document.getElementById('userName');
const joinButton = document.querySelector('.join-button');

// Function to display messages to the user (e.g., errors or success messages)
// We'll use a simple modal for this, instead of alert().
function showMessage(title, message, isError = false) {
    // Create a simple modal element
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

    // Style the modal (minimal inline styles for demonstration, ideally in CSS)
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

    // Close button functionality
    modal.querySelector('.close-button').onclick = () => {
        document.body.removeChild(modal);
    };

    // Close on outside click
    modal.onclick = (event) => {
        if (event.target === modal) {
            document.body.removeChild(modal);
        }
    };
}


// Function to handle user authentication (anonymous or custom token)
async function authenticateUser() {
    try {
        let userCredential;
        // Check if a custom auth token is provided by the Canvas environment
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        if (initialAuthToken) {
            // Sign in with the custom token provided by the Canvas environment
            userCredential = await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with custom token from Canvas environment.");
        } else {
            // Fallback to anonymous sign-in if no custom token is available (for standalone use)
            userCredential = await signInAnonymously(auth);
            console.log("Signed in anonymously.");
        }
        return userCredential.user;
    } catch (error) {
        console.error("Authentication error:", error);
        showMessage("Authentication Failed", "Could not sign in. Please try again.", true);
        return null;
    }
}

// Event listener for the login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent default form submission

    const roomCode = roomCodeInput.value.trim();
    const userName = userNameInput.value.trim();

    // Basic input validation
    if (!roomCode || !userName) {
        showMessage("Input Required", "Please enter both Room Code and User Name.", true);
        return;
    }

    // Disable button to prevent multiple submissions
    joinButton.disabled = true;
    joinButton.textContent = 'Joining...';

    try {
        // 1. Authenticate the user
        const user = await authenticateUser();
        if (!user) {
            // Authentication failed, message already shown by authenticateUser()
            return;
        }

        const userId = user.uid; // Get the authenticated user's ID

        // Define Firebase Realtime Database path for rooms
        const roomRef = ref(db, `rooms/${roomCode}`);
        const usersInRoomRef = child(roomRef, 'users');
        const currentUserRef = child(usersInRoomRef, userId);

        // 2. Check room status and join
        const snapshot = await get(roomRef);
        const roomData = snapshot.val();

        let canJoin = false;
        let existingUserFound = false;

        if (roomData) {
            // Room exists
            const activeUsers = roomData.users ? Object.values(roomData.users) : [];
            const activeUserCount = activeUsers.length;

            // Check if user with same userName already exists and is active
            if (activeUsers.some(u => u.userName === userName && u.userId !== userId)) {
                showMessage("Username Taken", "This username is already active in this room. Please choose another.", true);
                return; // Stop execution
            }

            // Check if the current userId is already associated with this userName in the room (rejoining)
            const userEntry = activeUsers.find(u => u.userId === userId);
            if (userEntry && userEntry.userName === userName) {
                // This is the same user rejoining with the same ID and name
                existingUserFound = true;
                canJoin = true; // Allow rejoining
            } else if (activeUserCount < 2) {
                // Room has space and username is not taken by an active user
                canJoin = true;
            } else {
                showMessage("Room Full", "This room is currently full (2 users). Please try another room.", true);
                return; // Stop execution
            }
        } else {
            // Room does not exist, create it
            canJoin = true;
        }

        if (canJoin) {
            // Set user's presence in the room
            const userPresenceData = {
                userId: userId,
                userName: userName,
                joinedAt: Date.now(),
                status: 'online'
            };

            await set(currentUserRef, userPresenceData); // Use set to ensure overwrite on rejoining

            // 3. Set up onDisconnect to remove user from room when they leave or refresh
            onDisconnect(currentUserRef).remove()
                .then(() => {
                    console.log(`OnDisconnect handler set for user ${userName} in room ${roomCode}`);
                })
                .catch((error) => {
                    console.error("Failed to set onDisconnect:", error);
                    // Even if onDisconnect fails, we should still let the user join
                });

            // Store room and user info in sessionStorage for access in chat.html
            sessionStorage.setItem('parichat_roomCode', roomCode);
            sessionStorage.setItem('parichat_userName', userName);
            sessionStorage.setItem('parichat_userId', userId);

            // Redirect to chat page
            window.location.href = 'chat.html';
        }

    } catch (error) {
        console.error("Error joining room:", error);
        showMessage("Error", "An unexpected error occurred. Please try again.", true);
    } finally {
        // Re-enable button
        joinButton.disabled = false;
        joinButton.textContent = 'JOIN ROOM';
    }
});

// Optional: If you want to check if the user is already authenticated on page load
// onAuthStateChanged(auth, (user) => {
//     if (user) {
//         // User is signed in. You might want to automatically redirect them
//         // if they have a saved roomCode in sessionStorage.
//         console.log("User already authenticated:", user.uid);
//         const storedRoomCode = sessionStorage.getItem('parichat_roomCode');
//         if (storedRoomCode) {
//             // Potentially redirect or show a "continue previous session" option
//             // For now, we'll let the user explicitly join.
//         }
//     } else {
//         // No user is signed in.
//         console.log("No user authenticated.");
//     }
// });

