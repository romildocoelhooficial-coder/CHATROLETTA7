import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, Mic, Volume2, BellRing } from 'lucide-react';
import { sounds } from '../services/audio.ts';

interface IncomingCallModalProps {
  isOpen: boolean;
  caller: {
    id: string;
    username: string;
    unique_code: string;
    avatar?: string;
    country?: string;
  } | null;
  callType: 'video' | 'audio';
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  isOpen,
  caller,
  callType,
  onAccept,
  onDecline,
}) => {
  const [soundActive, setSoundActive] = useState(true);

  useEffect(() => {
    if (isOpen && caller) {
      sounds.unlockAudio();
      sounds.startIncomingRing();
      setSoundActive(true);
    } else {
      sounds.stopAll();
    }

    return () => {
      sounds.stopAll();
    };
  }, [isOpen, caller]);

  if (!isOpen || !caller) return null;

  const triggerSoundManual = () => {
    sounds.unlockAudio();
    sounds.startIncomingRing();
    setSoundActive(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-sm bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-emerald-500/50 rounded-3xl shadow-2xl p-6 text-center overflow-hidden">
        {/* Animated radar rings in background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
          <div className="w-64 h-64 rounded-full border border-emerald-500 animate-ping" />
          <div className="w-44 h-44 rounded-full border border-indigo-500 animate-pulse" />
        </div>

        {/* Incoming Badge with Pulsing Bell */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full text-xs font-bold tracking-wide uppercase mb-4 animate-bounce">
          <BellRing className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Chamada Telefônica Recebida</span>
        </div>

        {/* Caller Avatar */}
        <div className="relative w-24 h-24 mx-auto mb-4">
          <img
            src={caller.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${caller.username}`}
            alt={caller.username}
            className="w-full h-full rounded-full object-cover border-4 border-emerald-500/80 shadow-2xl"
          />
          <div className="absolute -bottom-1 -right-1 p-2 bg-emerald-500 rounded-full text-white shadow-md animate-pulse">
            <Phone className="w-4 h-4" />
          </div>
        </div>

        {/* Caller Info */}
        <h3 className="text-xl font-extrabold text-white mb-0.5">{caller.username}</h3>
        <p className="font-mono text-sm font-black text-emerald-400 mb-1">
          {caller.unique_code}
        </p>
        {caller.country && (
          <p className="text-xs text-zinc-400 mb-3">{caller.country}</p>
        )}

        {/* Sound Alert Helper */}
        <div className="mb-5 flex flex-col items-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-300 font-semibold mb-1">
            <Volume2 className="w-4 h-4 animate-pulse text-emerald-400" />
            <span>Tocando melodia de chamada...</span>
          </div>
          <button
            type="button"
            onClick={triggerSoundManual}
            className="text-[11px] text-zinc-400 hover:text-emerald-300 underline transition cursor-pointer"
          >
            Não ouviu o toque? Clique aqui para desmutar
          </button>
        </div>

        {/* Action Buttons: Atender / Recusar */}
        <div className="flex items-center justify-center gap-8 pt-2">
          {/* Recusar */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => {
                sounds.stopAll();
                onDecline();
              }}
              className="w-16 h-16 bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-full flex items-center justify-center text-white shadow-xl shadow-red-600/40 transition transform hover:scale-105 active:scale-95 cursor-pointer"
              title="Recusar Chamada"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-xs font-bold text-red-400">Recusar</span>
          </div>

          {/* Atender */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => {
                sounds.stopAll();
                onAccept();
              }}
              className="w-18 h-18 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-full flex items-center justify-center text-white shadow-2xl shadow-emerald-500/50 transition transform hover:scale-110 active:scale-95 ring-4 ring-emerald-500/40 animate-pulse cursor-pointer"
              title="Atender Chamada"
            >
              <Phone className="w-8 h-8" />
            </button>
            <span className="text-xs font-extrabold text-emerald-400">Atender</span>
          </div>
        </div>
      </div>
    </div>
  );
};
