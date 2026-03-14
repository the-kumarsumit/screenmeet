import { X, Crown, User } from "lucide-react";

export default function ParticipantsPanel({
  hostName,
  participantName,
  onClose,
}) {
  const count = participantName ? 2 : 1;

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 sm:hidden"
        onClick={onClose}
      />
      
      <div className="fixed top-0 right-0 h-full w-full sm:w-80 bg-[#1a1a2e] border-l border-gray-700 z-50 flex flex-col animate-slide-in safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold text-sm sm:text-base">
            Participants ({count})
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-700 active:bg-gray-600 flex items-center justify-center touch-manipulation"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 overscroll-contain">
          <PersonRow
            icon={<Crown className="w-4 h-4 text-yellow-400" />}
            name={`${hostName} (You)`}
            role="Host"
            online
          />
          <PersonRow
            icon={<User className="w-4 h-4 text-gray-400" />}
            name={participantName || "Waiting..."}
            role="Participant"
            online={!!participantName}
          />
        </div>
      </div>
    </>
  );
}

function PersonRow({ icon, name, role, online }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-gray-800/60">
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm text-white truncate">{name}</p>
        <p className="text-[10px] sm:text-xs text-gray-500">{role}</p>
      </div>
      <div
        className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${
          online ? "bg-green-500" : "bg-gray-600"
        }`}
      />
    </div>
  );
}