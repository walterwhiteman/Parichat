// File: ChatRoom.js

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { ref, remove, onDisconnect } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { firestore, realtimeDB, storage } from "./firebase";
import VideoCall from "./VideoCall";

const ChatRoom = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [image, setImage] = useState(null);
  const [inCall, setInCall] = useState(false);
  const messagesEndRef = useRef(null);
  const username = localStorage.getItem("username");
  const roomId = localStorage.getItem("roomId");

  useEffect(() => {
    if (!username || !roomId) {
      navigate("/");
      return;
    }

    const messagesRef = collection(firestore, `rooms/${roomId}/messages`);
    const q = query(messagesRef, orderBy("createdAt"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });

    const presenceRef = ref(realtimeDB, `rooms/${roomId}/users/${username}`);
    onDisconnect(presenceRef).remove();

    const handleLeave = () => {
      remove(presenceRef);
      navigate("/");
    };

    window.addEventListener("beforeunload", handleLeave);
    window.onpopstate = handleLeave;

    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", handleLeave);
    };
  }, [navigate, roomId, username]);

  const handleSend = async () => {
    if (newMessage.trim() === "" && !image) return;
    const messagesRef = collection(firestore, `rooms/${roomId}/messages`);

    let imageUrl = null;
    if (image) {
      const imageRef = storageRef(storage, `rooms/${roomId}/images/${Date.now()}_${image.name}`);
      await uploadBytes(imageRef, image);
      imageUrl = await getDownloadURL(imageRef);
    }

    await addDoc(messagesRef, {
      text: newMessage,
      imageUrl: imageUrl || null,
      sender: username,
      createdAt: serverTimestamp(),
    });

    setNewMessage("");
    setImage(null);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between bg-blue-600 text-white p-4 fixed top-0 w-full z-10">
        <h2 className="text-lg font-semibold">Room: {roomId}</h2>
        <div className="flex gap-2">
          <button onClick={() => setInCall(true)} className="text-lg">📞</button>
          <button onClick={() => navigate("/")} className="text-sm hover:underline">
            Leave Room
          </button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 mt-16 mb-24 overflow-y-auto px-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`my-2 p-3 rounded-lg max-w-xs ${
              msg.sender === username ? "bg-blue-100 self-end" : "bg-gray-100 self-start"
            }`}
          >
            <p className="text-sm font-bold">{msg.sender}</p>
            {msg.text && <p>{msg.text}</p>}
            {msg.imageUrl && (
              <img
                src={msg.imageUrl}
                alt="uploaded"
                className="mt-2 max-w-full rounded-lg shadow"
              />
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="fixed bottom-0 w-full bg-white p-3 flex gap-2 border-t items-center">
        <input
          className="flex-1 p-2 border border-gray-300 rounded-xl"
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <input
          type="file"
          accept="image/*"
          className="hidden"
          id="imgInput"
          onChange={(e) => setImage(e.target.files[0])}
        />
        <label htmlFor="imgInput" className="cursor-pointer bg-blue-100 px-2 py-1 rounded-lg">
          📷
        </label>
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700"
        >
          Send
        </button>
      </div>

      {/* Video Call */}
      {inCall && (
        <VideoCall roomId={roomId} username={username} onClose={() => setInCall(false)} />
      )}
    </div>
  );
};

export default ChatRoom;
