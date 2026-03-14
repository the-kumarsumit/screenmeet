import {
  Mic,
  MicOff,
  MonitorUp,
  MonitorOff,
  Users,
  PhoneOff,
  Settings,
} from "lucide-react";

export default function ControlsBar({
  role,
  config,
  isMicOn,
  isScreenSharing,
  isSpeaking,
  onToggleMic,
  onToggleScreenShare,
  onToggleParticipants,
  onOpenSettings,
  onLeave,
}) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
      {/* ─── MIC ─── */}
      {config.micEnabled && (
        <ControlBtn
          onClick={onToggleMic}
          active={isMicOn}
          speaking={isSpeaking}
          title={isMicOn ? "Mute mic" : "Unmute mic"}
        >
          {isMicOn ? (
            <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </ControlBtn>
      )}

      {/* ─── SETTINGS (when mic is enabled) ─── */}
      {config.micEnabled && (
        <ControlBtn onClick={onOpenSettings} active title="Audio settings">
          <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
        </ControlBtn>
      )}

      {/* ─── SCREEN SHARE (host only) ─── */}
      {role === "host" && (
        <ControlBtn
          onClick={onToggleScreenShare}
          active={isScreenSharing}
          activeColor="blue"
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <MonitorUp className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </ControlBtn>
      )}

      {/* ─── PARTICIPANTS (host only) ─── */}
      {role === "host" && (
        <ControlBtn onClick={onToggleParticipants} active title="Participants">
          <Users className="w-4 h-4 sm:w-5 sm:h-5" />
        </ControlBtn>
      )}

      {/* ─── LEAVE ─── */}
      <button
        onClick={onLeave}
        className="h-10 sm:h-12 px-3 sm:px-5 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center gap-1.5 sm:gap-2 transition-all touch-manipulation"
        title="Leave"
      >
        <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        <span className="text-white text-xs sm:text-sm font-medium hidden xs:inline">
          Leave
        </span>
      </button>
    </div>
  );
}

function ControlBtn({
  children,
  onClick,
  active,
  speaking,
  activeColor,
  title,
}) {
  const bg = !active
    ? "bg-red-500 hover:bg-red-600 active:bg-red-700"
    : activeColor === "blue"
      ? "bg-blue-500 hover:bg-blue-600 active:bg-blue-700"
      : "bg-[#3c4043] hover:bg-[#4a4e51] active:bg-[#5a5e61]";

  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white transition-all touch-manipulation ${bg} ${
        speaking ? "mic-speaking" : ""
      }`}
    >
      {children}
    </button>
  );
}