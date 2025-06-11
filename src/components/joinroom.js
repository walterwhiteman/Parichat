// File: JoinRoom.js

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ref, set, onDisconnect } from "firebase/database";
import { realtimeDB } from "./firebase";

const JoinRoom = () => {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const savedUsername = localStorage.getItem("username");
    const savedRoomId = localStorage.getItem("roomId");
    if (savedUsername) setUsername(savedUsername);
    if (savedRoomId) setRoomId(savedRoomId);
  }, []);

  const handleJoin = async () => {
    if (!username || !roomId) return alert("Please enter both Room ID and Username.");

    // Save to localStorage
    localStorage.setItem("username", username);
    localStorage.setItem("roomId", roomId);

    // Mark user as present in Firebase Realtime DB
    const userStatusRef = ref(realtimeDB, `rooms/${roomId}/users/${username}`);
    await set(userStatusRef, { online: true, lastSeen: Date.now() });
    onDisconnect(userStatusRef).remove();

    navigate("/chat");
  };

  return (
    <div className="h-screen flex flex-col justify-center items-center bg-gray-100 p-4">
      <h1 className="text-3xl font-bold mb-6 text-purple-700">Parichat 💬</h1>
      <input
        className="w-full max-w-md mb-3 p-3 border border-gray-300 rounded-xl"
        type="text"
        placeholder="Enter Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
      />
      <input
        className="w-full max-w-md mb-3 p-3 border border-gray-300 rounded-xl"
        type="text"
        placeholder="Enter Your Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <button
        onClick={handleJoin}
        className="mt-4 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition"
      >
        Join Room
      </button>
    </div>
  );
};

export default JoinRoom;
