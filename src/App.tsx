import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { RouletteView } from './components/RouletteView.tsx';
import { DirectCallView } from './components/DirectCallView.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { IncomingCallModal } from './components/IncomingCallModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { ReportModal } from './components/ReportModal.tsx';
import { socketService } from './services/socket.ts';
import { sounds } from './services/audio.ts';
import { Ban, AlertCircle, Video, Phone, Shield } from 'lucide-react';

function MainApp() {
  const { user, bannedReason, clearBanNotice } = useAuth();
  const socket = socketService.getSocket();

  const [currentTab, setCurrentTab] = useState<'roulette' | 'direct' | 'admin'>('roulette');
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Incoming Call State
  const [incomingCall, setIncomingCall] = useState<{
    callId: string;
    callerSocketId: string;
    caller: {
      id: string;
      username: string;
      unique_code: string;
      avatar?: string;
      country?: string;
    };
    callType: 'video' | 'audio';
    isMock?: boolean;
  } | null>(null);

  // Active accepted session passed to DirectCallView
  const [activeCallSession, setActiveCallSession] = useState<any>(null);

  // Report Modal State
  const [reportData, setReportData] = useState<{ code: string; name: string } | null>(null);

  // Global listeners for Incoming Calls (Socket.io + Cross-Tab BroadcastChannel)
  useEffect(() => {
    // 1. Socket.io incoming call
    const onIncomingCall = (data: {
      callId: string;
      callerSocketId: string;
      caller: any;
      callType: 'video' | 'audio';
    }) => {
      console.log('[MainApp] Incoming Call received via Socket:', data);
      sounds.unlockAudio();
      sounds.startIncomingRing();
      setIncomingCall(data);
    };

    const onCallEnded = () => {
      setIncomingCall(null);
      sounds.stopAll();
    };

    socket.on('call:incoming', onIncomingCall);
    socket.on('call:ended', onCallEnded);

    // 2. Cross-tab BroadcastChannel incoming call (for multi-tab in same browser)
    const onBroadcastCall = (payload: {
      targetCode: string;
      callId: string;
      caller: any;
      callType: 'video' | 'audio';
      callerSocketId: string;
    }) => {
      if (user && payload.targetCode.toUpperCase() === user.unique_code.toUpperCase()) {
        console.log('[MainApp] Incoming Call received via Cross-Tab Broadcast:', payload);
        sounds.unlockAudio();
        sounds.startIncomingRing();
        setIncomingCall({
          callId: payload.callId,
          callerSocketId: payload.callerSocketId || 'cross_tab',
          caller: payload.caller,
          callType: payload.callType || 'video',
        });
      }
    };

    socketService.onLocal('call:incoming_broadcast', onBroadcastCall);

    return () => {
      socket.off('call:incoming', onIncomingCall);
      socket.off('call:ended', onCallEnded);
      socketService.offLocal('call:incoming_broadcast', onBroadcastCall);
    };
  }, [socket, user]);

  // Handle Accept Incoming Call
  const handleAcceptCall = () => {
    if (!incomingCall) return;
    sounds.stopAll();
    sounds.playConnectedChime();

    if (incomingCall.isMock || incomingCall.callerSocketId === 'mock_caller') {
      setActiveCallSession({
        callId: incomingCall.callId,
        caller: incomingCall.caller,
        callerSocketId: 'mock_caller',
        isMock: true,
      });
      setIncomingCall(null);
      setCurrentTab('direct');
      return;
    }

    // Inform socket
    socket.emit('call:accept', {
      callId: incomingCall.callId,
      callerSocketId: incomingCall.callerSocketId,
    });

    // Also broadcast cross-tab in case it was a multi-tab call
    socketService.broadcastLocal('call:accepted_broadcast', {
      callId: incomingCall.callId,
      receiverCode: user?.unique_code,
    });

    setActiveCallSession({
      callId: incomingCall.callId,
      caller: incomingCall.caller,
      callerSocketId: incomingCall.callerSocketId,
    });

    setIncomingCall(null);
    setCurrentTab('direct');
  };

  // Handle Decline Incoming Call
  const handleDeclineCall = () => {
    if (!incomingCall) return;
    sounds.stopAll();
    sounds.playHangupTone();

    if (!incomingCall.isMock && incomingCall.callerSocketId !== 'mock_caller') {
      socket.emit('call:reject', {
        callId: incomingCall.callId,
        callerSocketId: incomingCall.callerSocketId,
        reason: 'Chamada recusada pelo usuário.',
      });

      socketService.broadcastLocal('call:rejected_broadcast', {
        callId: incomingCall.callId,
      });
    }

    setIncomingCall(null);
  };

  // Simulated Incoming Call (Test helper requested by user)
  const handleTriggerTestIncomingCall = () => {
    sounds.unlockAudio();
    sounds.startIncomingRing();
    setIncomingCall({
      callId: `test_call_${Date.now()}`,
      callerSocketId: 'mock_caller',
      isMock: true,
      caller: {
        id: 'user_002',
        username: 'Lucas Silva (Chamada de Teste)',
        unique_code: '#CR-849201',
        country: 'Brasil 🇧🇷',
        avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      },
      callType: 'video',
    });
  };

  // Trigger Report Modal
  const handleOpenReport = (code: string, name: string) => {
    setReportData({ code, name });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main View Container */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentTab === 'roulette' && (
          <RouletteView onReportUser={handleOpenReport} />
        )}

        {currentTab === 'direct' && (
          <DirectCallView
            onReportUser={handleOpenReport}
            activeIncomingCallSession={activeCallSession}
            onClearIncomingSession={() => setActiveCallSession(null)}
            onTriggerTestIncomingCall={handleTriggerTestIncomingCall}
          />
        )}

        {currentTab === 'admin' && <AdminDashboard />}
      </main>

      {/* Incoming Call Modal (Telephone Ringing Popup with Atender / Recusar) */}
      <IncomingCallModal
        isOpen={!!incomingCall}
        caller={incomingCall?.caller || null}
        callType={incomingCall?.callType || 'video'}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
      />

      {/* Auth Modal (Login, Signup, Demo accounts) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={!!reportData}
        reportedCode={reportData?.code}
        reportedName={reportData?.name}
        onClose={() => setReportData(null)}
      />

      {/* Real-time Banned Notification Modal */}
      {bannedReason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-zinc-900 border-2 border-red-500/60 rounded-3xl p-6 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/40">
              <Ban className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Conta Suspensa pela Moderação</h3>
            <p className="text-xs text-red-300 bg-red-950/50 p-3 rounded-xl border border-red-500/30 mb-4">
              Motivo: {bannedReason}
            </p>
            <p className="text-xs text-zinc-400 mb-6">
              Sua conexão com as salas de vídeo foi interrompida de acordo com os termos de convivência da plataforma.
            </p>
            <button
              onClick={clearBanNotice}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl text-xs transition"
            >
              Compreendi e Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
