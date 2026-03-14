import { useState } from "react";
import HostForm from "../components/HostForm";
import JoinForm from "../components/JoinForm";

export default function Home() {
  const [tab, setTab] = useState("host");

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-xl sm:rounded-2xl mb-3 sm:mb-4 shadow-lg shadow-blue-600/30">
            <img src="/anime-and-manga-svgrepo-com.svg" alt="logo" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            2P Watch Party
          </h1>
          <p className="text-gray-400 text-sm sm:text-base mt-1 sm:mt-2">
            Instant watch party
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-800/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            {["host", "join"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition-all touch-manipulation ${
                  tab === t
                    ? t === "host"
                      ? "text-blue-400 border-b-2 border-blue-400 bg-blue-500/5"
                      : "text-green-400 border-b-2 border-green-400 bg-green-500/5"
                    : "text-gray-400 hover:text-gray-300 active:text-gray-200"
                }`}
              >
                {t === "host" ? "Admin Only" : "Join "}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-6">
            {tab === "host" ? <HostForm /> : <JoinForm />}
          </div>
        </div>
      </div>
    </div>
  );
}