import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onDisconnect, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC2UegRvjopP7D44-nKjooHQlkJuHsxZ8A",
  authDomain: "parichat-ilu.firebaseapp.com",
  projectId: "parichat-ilu",
  storageBucket: "parichat-ilu.firebasestorage.app",
  messagingSenderId: "425311672315",
  appId: "1:425311672315:web:da7b6ffc2847542cdd9d5e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const toggleVideoBtn = document.getElementById("toggleVideo");
const toggleAudioBtn = document.getElementById("toggleAudio");
const endCallBtn = document.getElementById("endCall");

const roomId = sessionStorage.getItem("roomId");
const username = sessionStorage.getItem("username");

let localStream;
let peerConnection;

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
  ]
};

async function startCall() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  peerConnection = new RTCPeerConnection(servers);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  const roomRef = ref(db, `rooms/${roomId}/call`);
  const caller = username;

  if (caller === "user1") {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await set(roomRef, { offer });

    onValue(roomRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && data.answer) {
        const remoteDesc = new RTCSessionDescription(data.answer);
        await peerConnection.setRemoteDescription(remoteDesc);
      }
    });
  } else {
    onValue(roomRef, async (snapshot) => {
      const data = snapshot.val();
      if (data && data.offer) {
        const offerDesc = new RTCSessionDescription(data.offer);
        await peerConnection.setRemoteDescription(offerDesc);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await set(roomRef, { ...data, answer });
      }
    });
  }

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      // Future enhancement: send ICE candidates for better reliability
    }
  };
}

startCall();

// Toggle video
let videoEnabled = true;
toggleVideoBtn.addEventListener("click", () => {
  videoEnabled = !videoEnabled;
  localStream.getVideoTracks()[0].enabled = videoEnabled;
});

// Toggle audio
let audioEnabled = true;
toggleAudioBtn.addEventListener("click", () => {
  audioEnabled = !audioEnabled;
  localStream.getAudioTracks()[0].enabled = audioEnabled;
});

// End call
endCallBtn.addEventListener("click", () => {
  peerConnection.close();
  window.location.href = "chatroom.html";
});
