import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff, Volume2, VolumeX } from "lucide-react";
import socket from "../socket";
import useWebRTC from "../hooks/useWebRTC";
import useAudioLevel from "../hooks/useAudioLevel";
import ControlsBar from "../components/ControlsBar";
import ParticipantsPanel from "../components/ParticipantsPanel";
import DeviceSelector from "../components/DeviceSelector";

/* ═══════════════════════════════════
   Redirect Component
═══════════════════════════════════ */
function Redirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/");
  }, [navigate]);

  return null;
}

/* ═══════════════════════════════════
   Placeholder
═══════════════════════════════════ */
function Placeholder({ role, hostName }) {
  return (
    <div className="text-center px-4">
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
        <span className="text-3xl sm:text-4xl">🖥️</span>
      </div>
      <p className="text-gray-400 text-sm sm:text-lg">
        {role === "host"
          ? 'Tap "Share Screen" to begin'
          : "Waiting for host to share screen…"}
      </p>
      {role === "participant" && (
        <p className="text-gray-600 text-xs sm:text-sm mt-2">Host: {hostName}</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════
   Badge
═══════════════════════════════════ */
function Badge({ icon, text, cls }) {
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 bg-black/50 backdrop-blur px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
      {icon}
      <span className={`text-[10px] sm:text-xs ${cls}`}>{text}</span>
    </div>
  );
}

/* ═══════════════════════════════════
   Main Room Component
═══════════════════════════════════ */
export default function Room() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state;

  /* ── UI state ── */
  const [isMicOn, setIsMicOn] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [participantName, setParticipantName] = useState(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [selectedMicId, setSelectedMicId] = useState(null);

  // Validate state
  const isValidState = !!state;
  const role = state?.role || "participant";
  const config = state?.config || { micEnabled: false };
  const name = state?.name || "User";
  const hostName = role === "host" ? name : state?.hostName || "Host";

  /* ── WebRTC ── */
  const {
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
  } = useWebRTC(roomId, role, config);

  /* ── Audio level (for mic button animation) ── */
  const isSpeaking = useAudioLevel(localStream, isMicOn);

  /* ── Refs ── */
  const screenVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  /* ── Attach remote audio stream ── */
  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    if (!audioEl) return;

    if (remoteStream) {
      audioEl.srcObject = remoteStream;
      audioEl.play().catch((err) => {
        console.log("Remote audio autoplay blocked:", err.message);
      });
    } else {
      audioEl.srcObject = null;
    }
  }, [remoteStream]);

  /* ── Attach screen share ── */
  useEffect(() => {
    const el = screenVideoRef.current;
    if (!el) return;

    if (role === "host" && screenStream) {
      el.srcObject = screenStream;
      el.muted = true;
    } else if (role === "participant" && remoteScreenStream) {
      el.srcObject = remoteScreenStream;
      el.muted = false;
      el.play()
        .then(() => setAudioBlocked(false))
        .catch(() => setAudioBlocked(true));
    } else {
      el.srcObject = null;
    }
  }, [role, screenStream, remoteScreenStream]);

  /* ── Socket events ── */
  useEffect(() => {
    const onJoined = ({ participantName: pn }) => setParticipantName(pn);
    const onLeft = () => setParticipantName(null);
    const onHostLeft = () => {
      cleanup();
      alert("Host ended the meeting.");
      navigate("/");
    };

    socket.on("participant-joined", onJoined);
    socket.on("participant-left", onLeft);
    socket.on("host-left", onHostLeft);

    return () => {
      socket.off("participant-joined", onJoined);
      socket.off("participant-left", onLeft);
      socket.off("host-left", onHostLeft);
    };
  }, [cleanup, navigate]);

  /* ── Handlers ── */
  const handleToggleMic = useCallback(async () => {
    if (toggling) return;
    setToggling(true);
    const next = !isMicOn;
    const success = await toggleMic(next, selectedMicId);
    if (success) setIsMicOn(next);
    setToggling(false);
  }, [toggling, isMicOn, toggleMic, selectedMicId]);

  const handleDeviceSelect = useCallback(
    async (deviceId) => {
      setSelectedMicId(deviceId);

      if (isMicOn) {
        setToggling(true);
        await toggleMic(false);
        const success = await toggleMic(true, deviceId);
        if (!success) setIsMicOn(false);
        setToggling(false);
      }
    },
    [isMicOn, toggleMic]
  );

  const handleToggleScreen = useCallback(() => {
    isScreenSharing ? stopScreenShare() : startScreenShare();
  }, [isScreenSharing, stopScreenShare, startScreenShare]);

  const handleLeave = useCallback(() => {
    socket.emit("leave-room");
    cleanup();
    navigate("/");
  }, [cleanup, navigate]);

  const unblockAudio = useCallback(() => {
    const el = screenVideoRef.current;
    if (!el) return;
    el.muted = false;
    el.play()
      .then(() => setAudioBlocked(false))
      .catch(() => {});
  }, []);

  // Redirect if invalid state
  if (!isValidState) return <Redirect />;

  /* ── Derived ── */
  const showScreen = role === "host" ? isScreenSharing : !!remoteScreenStream;

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="h-[100dvh] bg-[#202124] flex flex-col overflow-hidden relative select-none">
      {/* Hidden audio for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* ═══════ MAIN CONTENT ═══════ */}
      <div className="flex-1 flex p-1 sm:p-2 min-h-0">
        <div className="flex-1 bg-[#0f0f0f] rounded-lg sm:rounded-xl overflow-hidden relative flex items-center justify-center">
          {showScreen ? (
            <>
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />

              {/* Audio status badges */}
              {role === "participant" && (
                <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-10">
                  {audioBlocked ? (
                    <button
                      onClick={unblockAudio}
                      className="flex items-center gap-1.5 sm:gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full animate-pulse touch-manipulation"
                    >
                      <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="text-xs sm:text-sm font-medium">
                        Tap to hear audio
                      </span>
                    </button>
                  ) : screenHasAudio ? (
                    <Badge
                      icon={<Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400" />}
                      text="Tab audio"
                      cls="text-green-400"
                    />
                  ) : null}
                </div>
              )}

              {role === "host" && screenHasAudio && (
                <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-10">
                  <Badge
                    icon={<Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400" />}
                    text="Sharing tab audio"
                    cls="text-blue-400"
                  />
                </div>
              )}
            </>
          ) : (
            <Placeholder role={role} hostName={hostName} />
          )}

          {/* Connection status */}
          {connectionState !== "connected" && (
            <div className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-black/60 backdrop-blur px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
              <span className="text-[10px] sm:text-xs text-gray-300">
                {connectionState === "new" && role === "host"
                  ? "⏳ Waiting for participant…"
                  : connectionState === "new"
                    ? "⏳ Connecting…"
                    : `🔄 ${connectionState}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ CONTROLS ═══════ */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          uiHidden
            ? "h-0 opacity-0 overflow-hidden"
            : "h-[60px] sm:h-[76px] border-t border-white/10"
        }`}
      >
        <div className="h-full flex items-center justify-center px-2 sm:px-4 safe-area-bottom">
          <ControlsBar
            role={role}
            config={config}
            isMicOn={isMicOn}
            isScreenSharing={isScreenSharing}
            isSpeaking={isSpeaking}
            onToggleMic={handleToggleMic}
            onToggleScreenShare={handleToggleScreen}
            onToggleParticipants={() => setPanelOpen((p) => !p)}
            onOpenSettings={() => setSettingsOpen(true)}
            onLeave={handleLeave}
          />
        </div>
      </div>

      {/* Floating UI toggle */}
      <button
        onClick={() => setUiHidden((h) => !h)}
        className="fixed bottom-2 sm:bottom-4 right-2 sm:right-4 z-[100] w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur flex items-center justify-center transition-all touch-manipulation"
        title={uiHidden ? "Show UI" : "Hide UI"}
      >
        {uiHidden ? (
          <Eye className="w-4 h-4 text-white" />
        ) : (
          <EyeOff className="w-4 h-4 text-white" />
        )}
      </button>

      {/* Participants panel */}
      {panelOpen && role === "host" && (
        <ParticipantsPanel
          hostName={name}
          participantName={participantName}
          onClose={() => setPanelOpen(false)}
        />
      )}

      {/* Device selector modal */}
      {settingsOpen && (
        <DeviceSelector
          selectedDeviceId={selectedMicId}
          onSelect={handleDeviceSelect}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}