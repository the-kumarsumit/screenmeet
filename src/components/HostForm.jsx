import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Loader2 } from "lucide-react";
import socket from "../socket";

export default function HostForm() {
  const navigate = useNavigate();
  const [hostName, setHostName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [micEnabled, setMicEnabled] = useState(true); // ✅ Enabled by default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hostName.trim() || !roomId.trim()) {
      return setError("Fill in all fields.");
    }

    setLoading(true);
    setError("");
    if (!socket.connected) socket.connect();

    const config = { micEnabled };

    socket.emit("create-room", {
      roomId: roomId.trim(),
      config,
      hostName: hostName.trim(),
    });

    const onCreated = (data) => {
      off();
      navigate(`/room/${data.roomId}`, {
        state: {
          role: "host",
          config: data.config,
          name: hostName.trim(),
          roomId: data.roomId,
        },
      });
    };

    const onError = ({ message }) => {
      off();
      setError(message);
      setLoading(false);
    };

    const off = () => {
      socket.off("room-created", onCreated);
      socket.off("error-msg", onError);
    };

    socket.on("room-created", onCreated);
    socket.on("error-msg", onError);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <Field
        label="Your Name"
        value={hostName}
        onChange={setHostName}
        placeholder="e.g. Alice"
      />
      <Field
        label="Room ID"
        value={roomId}
        onChange={setRoomId}
        placeholder="e.g. my-room"
      />

      {/* Toggles */}
      <div>
        <p className="text-xs sm:text-sm font-medium text-gray-300 mb-2 sm:mb-3">
          Room Capabilities
        </p>
        <div className="flex gap-2 sm:gap-3">
          <Toggle
            active={micEnabled}
            onClick={() => setMicEnabled(!micEnabled)}
            icon={<Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
            label="Mic"
          />
        </div>
        <p className="text-[10px] sm:text-xs text-gray-500 mt-1.5 sm:mt-2">
          Disabled options won't appear in the room.
        </p>
      </div>

      {error && <ErrorBox message={error} />}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-sm sm:text-base font-semibold rounded-xl transition-all flex items-center justify-center gap-2 touch-manipulation"
      >
        {loading && <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />}
        Create Room
      </button>
    </form>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      />
    </div>
  );
}

function Toggle({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 rounded-xl border-2 transition-all touch-manipulation ${
        active
          ? "border-blue-500 bg-blue-500/20 text-blue-400"
          : "border-gray-600 bg-gray-700/30 text-gray-500 hover:border-gray-500 active:border-gray-400"
      }`}
    >
      {icon}
      <span className="text-xs sm:text-sm font-medium">{label}</span>
    </button>
  );
}

function ErrorBox({ message }) {
  return (
    <div className="text-red-400 text-xs sm:text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 sm:p-3">
      {message}
    </div>
  );
}