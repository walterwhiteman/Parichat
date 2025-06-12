// File: login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent the default form submission (page reload)

            const roomIdInput = document.getElementById('roomId');
            const usernameInput = document.getElementById('username');

            const roomId = roomIdInput.value.trim();
            const username = usernameInput.value.trim();

            // Basic validation
            if (!roomId) {
                alert('Please enter a Room ID.');
                roomIdInput.focus();
                return;
            }

            if (!username) {
                alert('Please enter a Username.');
                usernameInput.focus();
                return;
            }

            // Encode the values for URL safety
            const encodedRoomId = encodeURIComponent(roomId);
            const encodedUsername = encodeURIComponent(username);

            // Redirect to chatroom.html with room ID and username as query parameters
            // Assuming chatroom.html is in the same 'public' directory
            window.location.href = `chatroom.html?roomId=${encodedRoomId}&username=${encodedUsername}`;
        });
    } else {
        console.error('Login form not found. Ensure an element with id="loginForm" exists.');
    }
});
