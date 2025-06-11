// VideoCall.js

let localStream, remoteStream, peerConnection;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const toggleAudioBtn = document.getElementById('toggleAudio');
const toggleVideoBtn = document.getElementById('toggleVideo');
const endCallBtn = document.getElementById('endCall');

const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ]
};

async function startCall() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  peerConnection = new RTCPeerConnection(servers);
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = ({ streams: [stream] }) => {
    remoteVideo.srcObject = stream;
  };

  // Signaling logic goes here (Firebase or similar)
}

startCall();

// Toggle audio
let audioEnabled = true;
toggleAudioBtn.onclick = () => {
  audioEnabled = !audioEnabled;
  localStream.getAudioTracks()[0].enabled = audioEnabled;
  toggleAudioBtn.innerHTML = audioEnabled
    ? '<i class="figicon figicon-mic"></i>'
    : '<i class="figicon figicon-mic-off"></i>';
};

// Toggle video
let videoEnabled = true;
toggleVideoBtn.onclick = () => {
  videoEnabled = !videoEnabled;
  localStream.getVideoTracks()[0].enabled = videoEnabled;
  toggleVideoBtn.innerHTML = videoEnabled
    ? '<i class="figicon figicon-camera"></i>'
    : '<i class="figicon figicon-camera-off"></i>';
};

// End call
endCallBtn.onclick = () => {
  peerConnection.close();
  window.location.href = 'chatroom.html';
};
