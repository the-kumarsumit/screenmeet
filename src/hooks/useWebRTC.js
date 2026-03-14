import { useCallback, useEffect, useRef, useState } from "react";
import socket from "../socket";

const QUALITY = {
  screen: {
    maxBitrate: 8_000_000,
    maxFramerate: 30,
    scaleDown: 1.0,
    degradation: "maintain-resolution",
    codec: "video/VP9",
  },
  screenAudio: { maxBitrate: 192_000 },
  micAudio: { maxBitrate: 96_000 },
};

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
  ],
};

/* ═══════════════════════════════════════════════
   Silent audio dummy using shared AudioContext
═══════════════════════════════════════════════ */
let sharedAudioCtx = null;

function createSilentAudioTrack() {
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }

  const oscillator = sharedAudioCtx.createOscillator();
  const gain = sharedAudioCtx.createGain();
  const dest = sharedAudioCtx.createMediaStreamDestination();

  gain.gain.value = 0;
  oscillator.connect(gain);
  gain.connect(dest);
  oscillator.start();

  const track = dest.stream.getAudioTracks()[0];
  track._resources = { oscillator, gain, dest };

  console.log("🔇 Silent audio track created");
  return track;
}

function cleanupSilentTrack(track) {
  if (!track) return;
  try {
    if (track._resources) {
      track._resources.oscillator.stop();
      track._resources.oscillator.disconnect();
      track._resources.gain.disconnect();
      track._resources = null;
    }
    if (track.readyState === "live") track.stop();
  } catch (e) {
    console.warn("Cleanup error:", e);
  }
}

async function optimizeSender(sender, profile) {
  if (!sender?.track) return;
  try {
    const p = sender.getParameters();
    if (!p.encodings?.length) p.encodings = [{}];
    p.encodings[0].maxBitrate = profile.maxBitrate;
    if (profile.maxFramerate) p.encodings[0].maxFramerate = profile.maxFramerate;
    if (profile.scaleDown) p.encodings[0].scaleResolutionDownBy = profile.scaleDown;
    if (profile.degradation) p.degradationPreference = profile.degradation;
    p.encodings[0].networkPriority = profile === QUALITY.screen ? "high" : "medium";
    p.encodings[0].priority = profile === QUALITY.screen ? "high" : "medium";
    await sender.setParameters(p);
  } catch (e) {
    console.warn("Optimize sender error:", e);
  }
}

function preferCodec(pc, kind, mime) {
  try {
    const caps = RTCRtpReceiver.getCapabilities?.(kind);
    if (!caps) return;
    const pref = caps.codecs.filter((c) => c.mimeType.toLowerCase() === mime.toLowerCase());
    const rest = caps.codecs.filter((c) => c.mimeType.toLowerCase() !== mime.toLowerCase());
    if (!pref.length) return;
    for (const t of pc.getTransceivers()) {
      try {
        t.setCodecPreferences([...pref, ...rest]);
      } catch (e) {
        console.warn("Codec preference error:", e);
      }
    }
  } catch (e) {
    console.warn("preferCodec error:", e);
  }
}

/* ═══════════════════════════════════════
   MAIN HOOK
═══════════════════════════════════════ */
export default function useWebRTC(roomId, role, config) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenHasAudio, setScreenHasAudio] = useState(false);
  const [connectionState, setConnectionState] = useState("new");

  const pcRef = useRef(null);
  const localRef = useRef(null);
  const screenRef = useRef(null);
  const screenSenders = useRef([]);
  const remoteScreenId = useRef(null);
  const pendingIce = useRef([]);
  const isSettingRemote = useRef(false);
  const mountedRef = useRef(true);

  const audioSenderRef = useRef(null);
  const remoteCamStreamRef = useRef(null);

  // Use refs to avoid stale closures
  const configRef = useRef(config);
  const roomIdRef = useRef(roomId);
  const roleRef = useRef(role);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  /* ═══════════════════════════════════
     Create PeerConnection
  ═══════════════════════════════════ */
  const createPC = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    remoteCamStreamRef.current = null;

    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("ice-candidate", {
          roomId: roomIdRef.current,
          candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (mountedRef.current) setConnectionState(pc.connectionState);
      console.log("🔗 Connection:", pc.connectionState);
    };

    pc.ontrack = (e) => {
      const track = e.track;
      const stream = e.streams?.[0] || null;

      console.log(`📥 ontrack: ${track.kind}, stream=${stream?.id?.slice(0, 8) || "none"}`);

      const isScreen =
        !!stream && !!remoteScreenId.current && stream.id === remoteScreenId.current;

      if (isScreen) {
        console.log("📺 Remote screen track:", track.kind);
        if (mountedRef.current) {
          setRemoteScreenStream((prev) => (prev?.id === stream.id ? prev : stream));
        }
        return;
      }

      if (!remoteCamStreamRef.current) {
        remoteCamStreamRef.current = new MediaStream();
      }

      const unified = remoteCamStreamRef.current;
      const existing = unified.getTracks().find((t) => t.kind === track.kind);

      if (existing && existing.id !== track.id) {
        unified.removeTrack(existing);
      }
      if (!unified.getTracks().find((t) => t.id === track.id)) {
        unified.addTrack(track);
      }

      console.log(
        "🎤 Remote audio:",
        unified.getTracks().map((t) => `${t.kind}(${t.readyState})`).join(", ")
      );

      if (mountedRef.current) {
        setRemoteStream(new MediaStream(unified.getTracks()));
      }

      track.onunmute = () => {
        console.log(`🔔 Remote ${track.kind} unmuted`);
        if (mountedRef.current && remoteCamStreamRef.current) {
          setRemoteStream(new MediaStream(remoteCamStreamRef.current.getTracks()));
        }
      };
    };

    return pc;
  }, []);

  const initLocalStream = useCallback(() => {
    localRef.current = new MediaStream();
    setLocalStream(localRef.current);
  }, []);

  const addLocalTracks = useCallback((pc) => {
    const stream = localRef.current;
    const cfg = configRef.current;
    if (!stream) return;

    if (cfg.micEnabled) {
      const dummyAudio = createSilentAudioTrack();
      stream.addTrack(dummyAudio);
      const sender = pc.addTrack(dummyAudio, stream);
      audioSenderRef.current = sender;
      console.log("🎤 Audio dummy added via addTrack");
    }
  }, []);

  const addScreenTracks = useCallback((pc) => {
    if (!screenRef.current) return [];
    const senders = [];
    screenRef.current.getTracks().forEach((track) => {
      if (track.readyState === "live") {
        const sender = pc.addTrack(track, screenRef.current);
        senders.push(sender);
        if (track.kind === "video") {
          optimizeSender(sender, QUALITY.screen);
        } else {
          optimizeSender(sender, QUALITY.screenAudio);
        }
      }
    });
    preferCodec(pc, "video", QUALITY.screen.codec);
    return senders;
  }, []);

  const sendOffer = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState === "closed") return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", {
        roomId: roomIdRef.current,
        offer: pc.localDescription,
      });
      console.log("📤 Offer sent");
    } catch (e) {
      console.error("❌ sendOffer error:", e.message);
    }
  }, []);

  const handleOffer = useCallback(
    async ({ offer }) => {
      let pc = pcRef.current;
      const isAlive =
        pc &&
        pc.signalingState !== "closed" &&
        pc.connectionState !== "closed" &&
        pc.connectionState !== "failed";

      if (isAlive) {
        console.log("🔄 Renegotiating");
        if (pc.signalingState === "have-local-offer") {
          console.log("⚠️ Glare detected — rolling back local offer");
          await pc.setLocalDescription({ type: "rollback" });
        }
      } else {
        console.log("🆕 Creating new PC");
        audioSenderRef.current = null;
        pc = createPC();
        addLocalTracks(pc);
      }

      isSettingRemote.current = true;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
      } catch (e) {
        console.error("❌ setRemoteDescription failed:", e.message);
        isSettingRemote.current = false;
        return;
      }
      isSettingRemote.current = false;

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", {
        roomId: roomIdRef.current,
        answer: pc.localDescription,
      });
      console.log("📤 Answer sent");

      pendingIce.current.forEach((c) =>
        pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
      );
      pendingIce.current = [];
    },
    [createPC, addLocalTracks]
  );

  const handleAnswer = useCallback(async ({ answer }) => {
    const pc = pcRef.current;
    if (!pc) return;
    if (pc.signalingState !== "have-local-offer") {
      console.warn("⚠️ Unexpected state for answer:", pc.signalingState);
      return;
    }

    isSettingRemote.current = true;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (e) {
      console.error("❌ setRemoteDescription (answer) failed:", e.message);
    }
    isSettingRemote.current = false;

    pendingIce.current.forEach((c) =>
      pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
    );
    pendingIce.current = [];
    console.log("📥 Answer processed");
  }, []);

  const handleIce = useCallback(({ candidate }) => {
    const pc = pcRef.current;
    if (pc?.remoteDescription && !isSettingRemote.current) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    } else {
      pendingIce.current.push(candidate);
    }
  }, []);

  /* ═══════════════════════════════════
     toggleMic
  ═══════════════════════════════════ */
  const toggleMic = useCallback(async (on, deviceId = null) => {
    if (on) {
      try {
        const audioConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        };

        if (deviceId) {
          audioConstraints.deviceId = { exact: deviceId };
        }

        console.log("🎤 Requesting mic with constraints:", audioConstraints);

        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });

        const newTrack = audioStream.getAudioTracks()[0];
        newTrack.enabled = true;
        console.log("🎤 Mic acquired:", newTrack.label);

        localRef.current?.getAudioTracks().forEach((t) => {
          localRef.current.removeTrack(t);
          cleanupSilentTrack(t);
          if (t.readyState === "live") t.stop();
        });
        localRef.current?.addTrack(newTrack);

        if (audioSenderRef.current) {
          await audioSenderRef.current.replaceTrack(newTrack);
          await optimizeSender(audioSenderRef.current, QUALITY.micAudio);

          const pc = pcRef.current;
          if (pc) {
            for (const t of pc.getTransceivers()) {
              if (t.sender === audioSenderRef.current) {
                if (t.direction !== "sendrecv" && t.direction !== "sendonly") {
                  t.direction = "sendrecv";
                }
                break;
              }
            }
          }
          console.log("🎤 replaceTrack done ✓");
        }

        if (mountedRef.current) {
          setLocalStream(new MediaStream(localRef.current.getTracks()));
        }

        return true;
      } catch (err) {
        console.error("❌ Mic error:", err.message);
        return false;
      }
    } else {
      localRef.current?.getAudioTracks().forEach((t) => {
        console.log(`🎤 Stopping: ${t.label} (${t.readyState})`);
        localRef.current.removeTrack(t);
        if (!t._resources) {
          t.stop();
        } else {
          cleanupSilentTrack(t);
        }
      });

      if (audioSenderRef.current) {
        try {
          const freshDummy = createSilentAudioTrack();
          localRef.current?.addTrack(freshDummy);
          await audioSenderRef.current.replaceTrack(freshDummy);
          console.log("🔇 Replaced with silent dummy");
        } catch (e) {
          console.warn("Dummy replacement failed:", e.message);
          try {
            await audioSenderRef.current.replaceTrack(null);
          } catch (err) {
            console.warn("replaceTrack(null) failed:", err);
          }
        }
      }

      if (mountedRef.current) {
        setLocalStream(new MediaStream(localRef.current?.getTracks() || []));
      }

      console.log("🎤 Mic OFF ✓");
      return true;
    }
  }, []);

  /* ═══════════════════════════════════
     Screen Share
  ═══════════════════════════════════ */
  const stopScreenShare = useCallback(async () => {
    const pc = pcRef.current;

    if (pc) {
      screenSenders.current.forEach((s) => {
        try {
          pc.removeTrack(s);
        } catch (e) {
          console.warn("removeTrack error:", e);
        }
      });
    }
    screenSenders.current = [];

    if (screenRef.current) {
      screenRef.current.getTracks().forEach((t) => t.stop());
      screenRef.current = null;
    }

    if (mountedRef.current) {
      setScreenStream(null);
      setIsScreenSharing(false);
      setScreenHasAudio(false);
    }

    socket.emit("screen-share-stopped", { roomId: roomIdRef.current });

    if (pc && pc.signalingState !== "closed") {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", {
          roomId: roomIdRef.current,
          offer: pc.localDescription,
        });
      } catch (e) {
        console.warn("Offer after screen stop failed:", e);
      }
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          frameRate: { ideal: 30, max: 60 },
          cursor: "always",
        },
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
          channelCount: 2,
          sampleRate: 48000,
        },
      });

      screenRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);

      const hasAudio = stream.getAudioTracks().length > 0;
      setScreenHasAudio(hasAudio);

      stream.getVideoTracks().forEach((t) => {
        if ("contentHint" in t) t.contentHint = "detail";
      });

      const pc = pcRef.current;
      if (pc && pc.signalingState !== "closed") {
        const senders = addScreenTracks(pc);
        screenSenders.current = senders;

        socket.emit("screen-share-started", {
          roomId: roomIdRef.current,
          streamId: stream.id,
          hasAudio,
        });

        await sendOffer();
      } else {
        socket.emit("screen-share-started", {
          roomId: roomIdRef.current,
          streamId: stream.id,
          hasAudio,
        });
      }

      stream.getVideoTracks()[0].onended = () => stopScreenShare();
    } catch (err) {
      console.log("Screen share cancelled:", err.message);
    }
  }, [sendOffer, addScreenTracks, stopScreenShare]);

  const cleanup = useCallback(() => {
    localRef.current?.getTracks().forEach((t) => {
      cleanupSilentTrack(t);
      if (t.readyState === "live") t.stop();
    });
    screenRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current = null;
    screenRef.current = null;
    screenSenders.current = [];
    audioSenderRef.current = null;
    pendingIce.current = [];
    remoteScreenId.current = null;
    remoteCamStreamRef.current = null;
  }, []);

  /* ═══════════════════════════════════
     Main Effect
  ═══════════════════════════════════ */
  useEffect(() => {
    mountedRef.current = true;
    if (!socket.connected) socket.connect();

    initLocalStream();

    if (roleRef.current === "participant") {
      socket.emit("ready", { roomId: roomIdRef.current });
    }

    const onParticipantReady = async () => {
      console.log("👤 Participant ready");
      audioSenderRef.current = null;

      const pc = createPC();
      addLocalTracks(pc);

      if (screenRef.current) {
        const senders = addScreenTracks(pc);
        screenSenders.current = senders;
        socket.emit("screen-share-started", {
          roomId: roomIdRef.current,
          streamId: screenRef.current.id,
          hasAudio: screenRef.current.getAudioTracks().length > 0,
        });
      }

      await sendOffer();
    };

    const onScreenShareStarted = ({ streamId }) => {
      remoteScreenId.current = streamId;
    };

    const onScreenShareStopped = () => {
      remoteScreenId.current = null;
      if (mountedRef.current) setRemoteScreenStream(null);
    };

    socket.on("participant-ready", onParticipantReady);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIce);
    socket.on("screen-share-started", onScreenShareStarted);
    socket.on("screen-share-stopped", onScreenShareStopped);

    return () => {
      mountedRef.current = false;
      socket.off("participant-ready", onParticipantReady);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIce);
      socket.off("screen-share-started", onScreenShareStarted);
      socket.off("screen-share-stopped", onScreenShareStopped);
      cleanup();
    };
  }, [
    initLocalStream,
    createPC,
    addLocalTracks,
    addScreenTracks,
    sendOffer,
    handleOffer,
    handleAnswer,
    handleIce,
    cleanup,
  ]);

  return {
    localStream,
    remoteStream,
    screenStream,
    remoteScreenStream,
    isScreenSharing,
    screenHasAudio,
    connectionState,
    startScreenShare,
    stopScreenShare,
    toggleMic,
    cleanup,
  };
}