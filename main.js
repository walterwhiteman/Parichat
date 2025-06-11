// main.js

// Save user info and navigate to chatroom
const joinBtn = document.getElementById("joinBtn");
const usernameInput = document.getElementById("username");
const roomInput = document.getElementById("roomId");

joinBtn.addEventListener("click", () => {
  const username = usernameInput.value.trim();
  const roomId = roomInput.value.trim();

  if (!username || !roomId) {
    alert("Both username and room ID are required.");
    return;
  }

  localStorage.setItem("parichat-username", username);
  localStorage.setItem("parichat-roomId", roomId);

  window.location.href = "chatroom.html";
});
