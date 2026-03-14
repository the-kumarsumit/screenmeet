import { useState, useEffect } from "react";
import { Settings, Mic, X, Check } from "lucide-react";

export default function DeviceSelector({ selectedDeviceId, onSelect, onClose }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tempSelected, setTempSelected] = useState(selectedDeviceId);

  useEffect(() => {
    async function loadDevices() {
      try {
        // Request permission first to get labeled devices
        await navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            stream.getTracks().forEach((track) => track.stop());
          })
          .catch(() => {});

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter((d) => d.kind === "audioinput");
        setDevices(audioInputs);

        // If no device selected yet, select the first one
        if (!selectedDeviceId && audioInputs.length > 0) {
          setTempSelected(audioInputs[0].deviceId);
        }
      } catch (err) {
        console.error("Failed to enumerate devices:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDevices();

    // Listen for device changes
    const handleDeviceChange = () => loadDevices();
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [selectedDeviceId]);

  const handleSave = () => {
    onSelect(tempSelected);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#2d2d2d] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl border-t sm:border border-gray-700 animate-slide-up sm:animate-fade-in max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm sm:text-base">Audio Settings</h3>
              <p className="text-gray-400 text-[10px] sm:text-xs">Select your microphone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-700 active:bg-gray-600 flex items-center justify-center transition-colors touch-manipulation"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Device List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 overscroll-contain">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Loading devices...</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8">
              <Mic className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No microphones found</p>
              <p className="text-gray-500 text-xs mt-1">
                Please connect a microphone and try again
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide mb-2 sm:mb-3">
                Microphone Input
              </p>
              {devices.map((device) => (
                <button
                  key={device.deviceId}
                  onClick={() => setTempSelected(device.deviceId)}
                  className={`
                    w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl transition-all touch-manipulation
                    ${
                      tempSelected === device.deviceId
                        ? "bg-blue-500/20 border-2 border-blue-500"
                        : "bg-gray-800/50 border-2 border-transparent hover:bg-gray-700/50 active:bg-gray-700"
                    }
                  `}
                >
                  <div
                    className={`
                      w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0
                      ${
                        tempSelected === device.deviceId
                          ? "bg-blue-500"
                          : "bg-gray-700"
                      }
                    `}
                  >
                    <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs sm:text-sm text-white truncate">
                      {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                      {device.deviceId === "default"
                        ? "System Default"
                        : device.deviceId.slice(0, 16) + "..."}
                    </p>
                  </div>
                  {tempSelected === device.deviceId && (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-gray-700 flex gap-2 sm:gap-3 shrink-0 safe-area-bottom">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 sm:py-3 rounded-xl bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-sm font-medium transition-colors touch-manipulation"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!tempSelected}
            className="flex-1 py-2.5 sm:py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-sm font-medium transition-colors touch-manipulation"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}