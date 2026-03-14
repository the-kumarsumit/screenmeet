import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import socket from "../socket";

export default function JoinForm() {
  const navigate = useNavigate();
  const [participantName, setParticipantName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!participantName.trim() || !roomId.trim()) {
      return setError("Fill in all fields.");
    }

    setLoading(true);
    setError("");
    if (!socket.connected) socket.connect();

    socket.emit("join-room", {
      roomId: roomId.trim(),
      participantName: participantName.trim(),
    });

    const onJoined = (data) => {
      off();
      navigate(`/room/${data.roomId}`, {
        state: {
          role: "participant",
          config: data.config,
          name: participantName.trim(),
          roomId: data.roomId,
          hostName: data.hostName,
        },
      });
    };

    const onError = ({ message }) => {
      off();
      setError(message);
      setLoading(false);
    };

    const off = () => {
      socket.off("room-joined", onJoined);
      socket.off("error-msg", onError);
    };

    socket.on("room-joined", onJoined);
    socket.on("error-msg", onError);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-1.5">
          Your Name
        </label>
        <input
          type="text"
          value={participantName}
          onChange={(e) => setParticipantName(e.target.value)}
          placeholder="e.g. Bob"
          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
        />
      </div>

      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1 sm:mb-1.5">
          Room ID
        </label>
        <input
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Enter the room ID"
          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
        />
      </div>

      {error && (
        <div className="text-red-400 text-xs sm:text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 sm:p-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-50 text-white text-sm sm:text-base font-semibold rounded-xl transition-all flex items-center justify-center gap-2 touch-manipulation"
      >
        {loading && <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />}
        Join Room
      </button>
    </form>
  );
}