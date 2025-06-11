// File: VideoCall.js

import React, { useEffect, useRef, useState } from "react";
import { ref, set, onValue, remove } from "firebase/database";
import { realtimeDB } from "./firebase";

const VideoCall = ({ roomId, username, onClose }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);

  useEffect(() => {
    const localStreamPromise = navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const callRef = ref(realtimeDB, `calls/${roomId}`);

    const initCall = async () => {
      const localStream = await localStreamPromise;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      pcRef.current = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      localStream.getTracks().forEach(track => pcRef.current.addTrack(track, localStream));

      pcRef.current.onicecandidate = event => {
        if (event.candidate) {
          set(ref(realtimeDB, `calls/${roomId}/candidates/${username}`), event.candidate);
        }
      };

      pcRef.current.ontrack = event => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      const offerRef = ref(realtimeDB, `calls/${roomId}/offer`);
      const answerRef = ref(realtimeDB, `calls/${roomId}/answer`);

      onValue(offerRef, async snapshot => {
        const offer = snapshot.val();
        if (offer && offer.username !== username) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          set(answerRef, { ...answer, username });
        }
      });

      onValue(answerRef, async snapshot => {
        const answer = snapshot.val();
        if (answer && answer.username !== username) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      set(offerRef, { ...offer, username });
    };

    initCall();

    return () => {
      localStreamPromise.then(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
      pcRef.current && pcRef.current.close();
      remove(callRef);
    };
  }, [roomId, username]);

  const toggleMute = () => {
    const stream = localVideoRef.current.srcObject;
    stream.getAudioTracks().forEach(track => (track.enabled = !track.enabled));
    setMuted(!muted);
  };

  const toggleCamera = () => {
    const stream = localVideoRef.current.srcObject;
    stream.getVideoTracks().forEach(track => (track.enabled = !track.enabled));
    setCameraOn(!cameraOn);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col justify-center items-center">
      <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <video ref={localVideoRef} autoPlay playsInline muted className="w-32 h-32 fixed bottom-24 right-4 rounded-lg shadow-lg border border-white" />
      <div className="fixed bottom-4 flex justify-center gap-4">
        <button
          onClick={toggleMute}
          className="bg-gray-200 rounded-full p-4 text-xl"
        >
          {muted ? "🔇" : "🎤"}
        </button>
        <button
          onClick={toggleCamera}
          className="bg-gray-200 rounded-full p-4 text-xl"
        >
          {cameraOn ? "📷" : "🚫"}
        </button>
        <button
          onClick={onClose}
          className="bg-red-600 text-white rounded-full p-4 text-xl"
        >
          ❌
        </button>
      </div>
    </div>
  );
};

export default VideoCall;
