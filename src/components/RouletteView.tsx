import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { socketService } from '../services/socket.ts';
import { WebRTCManager, createMockPeerStream } from '../services/webrtc.ts';
import { sounds } from '../services/audio.ts';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Play,
  SkipForward,
  Square,
  MessageSquare,
  Send,
  Flag,
  Sparkles,
  Compass,
  Radio,
  Volume2,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface RouletteViewProps {
  onReportUser: (code: string, name: string) => void;
}

interface PeerInfo {
  id: string;
  username: string;
  unique_code: string;
  country?: string;
  avatar?: string;
}

interface ChatMessage {
  id: string;
  sender_name: string;
  text: string;
  timestamp: string;
  isSelf: boolean;
}

export const RouletteView: React.FC<RouletteViewProps> = ({ onReportUser }) => {
  const { user } = useAuth();
  const socket = socketService.getSocket();

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'connecting' | 'connected' | 'idle'>('idle');

  // Roulette status: 'idle' | 'searching' | 'connected'
  const [rouletteState, setRouletteState] = useState<'idle' | 'searching' | 'connected'>('idle');
  const [currentPeer, setCurrentPeer] = useState<PeerInfo | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [peerSocketId, setPeerSocketId] = useState<string | null>(null);

  // Country filter
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // Chat & Reactions
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string; x: number }[]>([]);

  // Simulation mode
  const [simulatedPeerActive, setSimulatedPeerActive] = useState(false);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Initialize camera and mic
  const initLocalMedia = useCallback(async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCameraError(null);
      return stream;
    } catch (err: any) {
      console.warn('Physical camera unavailable, using virtual test stream:', err);
      setCameraError('Câmera física não encontrada. Usando stream virtual.');
      const fallbackStream = createMockPeerStream(user?.username || 'Você');
      localStreamRef.current = fallbackStream;
      setLocalStream(fallbackStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = fallbackStream;
      }
      return fallbackStream;
    }
  }, [user]);

  useEffect(() => {
    initLocalMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (webrtcRef.current) {
        webrtcRef.current.close();
      }
    };
  }, []);

  // Update video element when remote stream changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((e) => console.log('Autoplay handled:', e));
    }
  }, [remoteStream]);

  // Clean disconnect
  const cleanupCall = useCallback(() => {
    if (webrtcRef.current) {
      webrtcRef.current.close();
      webrtcRef.current = null;
    }
    setRemoteStream(null);
    setCurrentPeer(null);
    setCurrentRoomId(null);
    setPeerSocketId(null);
    setMessages([]);
    setSimulatedPeerActive(false);
    setConnectionQuality('idle');
  }, []);

  // Socket Roulette Event Listeners & Cross-Tab Relays
  useEffect(() => {
    const handleMatched = async (data: {
      roomId: string;
      isInitiator: boolean;
      peerSocketId: string;
      peer: PeerInfo;
    }) => {
      console.log('[Roulette] Matched with peer:', data);
      sounds.stopAll();
      sounds.playConnectedChime();
      cleanupCall();

      setCurrentRoomId(data.roomId);
      setPeerSocketId(data.peerSocketId);
      setCurrentPeer(data.peer);
      setRouletteState('connected');
      setConnectionQuality('connecting');

      // Ensure local media is ready
      let activeStream = localStreamRef.current;
      if (!activeStream) {
        activeStream = await initLocalMedia();
      }

      // Initialize WebRTC
      const rtc = new WebRTCManager({
        onRemoteStream: (stream) => {
          console.log('[Roulette] Got remote stream tracks:', stream.getTracks().length);
          setRemoteStream(stream);
          setConnectionQuality('connected');
        },
        onIceCandidate: (candidate) => {
          socket.emit('webrtc:ice_candidate', {
            toSocketId: data.peerSocketId,
            candidate,
            roomId: data.roomId,
          });
          socketService.broadcastLocal('webrtc:ice_candidate_broadcast', {
            toSocketId: data.peerSocketId,
            candidate,
            roomId: data.roomId,
          });
        },
        onConnectionStateChange: (state) => {
          console.log('[Roulette] Peer connection state:', state);
          if (state === 'connected') {
            setConnectionQuality('connected');
          } else if (state === 'disconnected' || state === 'failed') {
            setConnectionQuality('idle');
          }
        },
      });

      webrtcRef.current = rtc;
      rtc.initConnection(activeStream);

      if (data.isInitiator) {
        try {
          const offer = await rtc.createOffer();
          socket.emit('webrtc:offer', {
            toSocketId: data.peerSocketId,
            sdp: offer,
            roomId: data.roomId,
          });
          socketService.broadcastLocal('webrtc:offer_broadcast', {
            toSocketId: data.peerSocketId,
            sdp: offer,
            roomId: data.roomId,
          });
        } catch (e) {
          console.error('[Roulette] Error creating offer:', e);
        }
      }
    };

    const handlePeerLeft = (data: { reason?: string }) => {
      console.log('[Roulette] Peer left:', data);
      sounds.playHangupTone();
      cleanupCall();
      startSearching(true);
    };

    // WebRTC signaling handlers
    const handleOffer = async (payload: { fromSocketId: string; sdp: any; roomId?: string }) => {
      if (webrtcRef.current) {
        try {
          const answer = await webrtcRef.current.handleOffer(payload.sdp);
          socket.emit('webrtc:answer', {
            toSocketId: payload.fromSocketId,
            sdp: answer,
            roomId: payload.roomId,
          });
          socketService.broadcastLocal('webrtc:answer_broadcast', {
            toSocketId: payload.fromSocketId,
            sdp: answer,
            roomId: payload.roomId,
          });
        } catch (e) {
          console.error('Error handling offer:', e);
        }
      }
    };

    const handleAnswer = async (payload: { fromSocketId: string; sdp: any }) => {
      if (webrtcRef.current) {
        try {
          await webrtcRef.current.handleAnswer(payload.sdp);
        } catch (e) {
          console.error('Error handling answer:', e);
        }
      }
    };

    const handleCandidate = async (payload: { candidate: any }) => {
      if (webrtcRef.current) {
        try {
          await webrtcRef.current.addIceCandidate(payload.candidate);
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    };

    // Chat
    const handleChatMessage = (msg: { id: string; sender_name: string; text: string; timestamp: string; sender_id: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: msg.id,
          sender_name: msg.sender_name,
          text: msg.text,
          timestamp: msg.timestamp,
          isSelf: msg.sender_id === socket.id,
        },
      ]);
    };

    const handleReaction = (payload: { emoji: string }) => {
      triggerFloatingEmoji(payload.emoji);
    };

    socket.on('roulette:matched', handleMatched);
    socket.on('roulette:peer_left', handlePeerLeft);
    socket.on('webrtc:offer', handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice_candidate', handleCandidate);
    socket.on('chat:message', handleChatMessage);
    socket.on('call:reaction', handleReaction);

    socketService.onLocal('webrtc:offer_broadcast', handleOffer);
    socketService.onLocal('webrtc:answer_broadcast', handleAnswer);
    socketService.onLocal('webrtc:ice_candidate_broadcast', handleCandidate);

    return () => {
      socket.off('roulette:matched', handleMatched);
      socket.off('roulette:peer_left', handlePeerLeft);
      socket.off('webrtc:offer', handleOffer);
      socket.off('webrtc:answer', handleAnswer);
      socket.off('webrtc:ice_candidate', handleCandidate);
      socket.off('chat:message', handleChatMessage);
      socket.off('call:reaction', handleReaction);

      socketService.offLocal('webrtc:offer_broadcast', handleOffer);
      socketService.offLocal('webrtc:answer_broadcast', handleAnswer);
      socketService.offLocal('webrtc:ice_candidate_broadcast', handleCandidate);
    };
  }, [socket, cleanupCall, initLocalMedia]);

  // Scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start Searching
  const startSearching = (immediate = false) => {
    cleanupCall();
    setRouletteState('searching');
    sounds.playNextSkip();
    socket.emit('roulette:join_queue', { filter: selectedFilter });
  };

  // Stop / Cancel Searching
  const stopSearching = () => {
    socket.emit('roulette:leave_queue');
    cleanupCall();
    setRouletteState('idle');
  };

  // Skip to Next User
  const handleNextUser = () => {
    sounds.playNextSkip();
    if (currentRoomId) {
      socket.emit('roulette:next', { roomId: currentRoomId, rejoin: true });
    }
    cleanupCall();
    setRouletteState('searching');
    socket.emit('roulette:join_queue', { filter: selectedFilter });
  };

  // Disconnect call completely
  const handleDisconnect = () => {
    sounds.playHangupTone();
    if (currentRoomId) {
      socket.emit('roulette:next', { roomId: currentRoomId, rejoin: false });
    }
    cleanupCall();
    setRouletteState('idle');
  };

  // Simulate Instant Peer for Solo Testing
  const triggerSoloSimulator = () => {
    cleanupCall();
    setSimulatedPeerActive(true);
    setRouletteState('connected');
    setConnectionQuality('connected');
    sounds.stopAll();
    sounds.playConnectedChime();

    const mockNames = [
      { name: 'Elena Rostova', code: '#CR-771923', country: 'Alemanha 🇩🇪' },
      { name: 'Kenji Sato', code: '#CR-394821', country: 'Japão 🇯🇵' },
      { name: 'Camila Rossi', code: '#CR-820155', country: 'Itália 🇮🇹' },
    ];
    const chosen = mockNames[Math.floor(Math.random() * mockNames.length)];

    setCurrentPeer({
      id: 'sim_bot',
      username: `${chosen.name}`,
      unique_code: chosen.code,
      country: chosen.country,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${chosen.name}`,
    });

    const simStream = createMockPeerStream(chosen.name);
    setRemoteStream(simStream);

    setTimeout(() => {
      setMessages([
        {
          id: 'sim_1',
          sender_name: chosen.name,
          text: `Olá! Conexão de vídeo lado a lado estabelecida com sucesso. Áudio e vídeo operando!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSelf: false,
        },
      ]);
    }, 800);
  };

  // Toggle Mute
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle Camera
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  // Send Chat message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');

    if (simulatedPeerActive) {
      setMessages((prev) => [
        ...prev,
        {
          id: `self_${Date.now()}`,
          sender_name: user?.username || 'Você',
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSelf: true,
        },
      ]);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `sim_reply_${Date.now()}`,
            sender_name: currentPeer?.username || 'Parceiro',
            text: 'Perfeito! A transmissão P2P lado a lado está excelente.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSelf: false,
          },
        ]);
      }, 1000);
      return;
    }

    if (peerSocketId && currentRoomId) {
      socket.emit('chat:message', {
        roomId: currentRoomId,
        toSocketId: peerSocketId,
        text,
        senderName: user?.username || 'Usuário',
      });
    }
  };

  // Trigger floating emoji reaction
  const triggerFloatingEmoji = (emoji: string) => {
    const id = `emoji_${Date.now()}_${Math.random()}`;
    const x = Math.floor(20 + Math.random() * 60);
    setFloatingEmojis((prev) => [...prev, { id, emoji, x }]);

    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 2000);
  };

  const sendReaction = (emoji: string) => {
    triggerFloatingEmoji(emoji);
    if (!simulatedPeerActive && (currentRoomId || peerSocketId)) {
      socket.emit('call:reaction', {
        roomId: currentRoomId || undefined,
        toSocketId: peerSocketId || undefined,
        emoji,
      });
    }
  };

  return (
    <div className="relative flex flex-col flex-1 h-[calc(100vh-65px)] bg-zinc-950 overflow-hidden">
      {/* Top Banner / Status Info */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-2.5 w-2.5 rounded-full ${
              rouletteState === 'connected'
                ? 'bg-emerald-400 animate-pulse'
                : rouletteState === 'searching'
                ? 'bg-amber-400 animate-ping'
                : 'bg-zinc-500'
            }`}
          />
          <span className="font-bold text-zinc-200">
            {rouletteState === 'idle' && 'Roleta Pronta — Vídeos Lado a Lado'}
            {rouletteState === 'searching' && 'Buscando parceiro aleatório global...'}
            {rouletteState === 'connected' && `Conectado com: ${currentPeer?.username || 'Parceiro'}`}
          </span>
          {currentPeer && (
            <span className="font-mono text-[11px] text-emerald-400 font-bold px-2 py-0.5 bg-emerald-500/10 rounded-md border border-emerald-500/20">
              {currentPeer.unique_code}
            </span>
          )}
          {currentPeer?.country && (
            <span className="text-zinc-400">{currentPeer.country}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {connectionQuality === 'connected' && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" /> P2P Ativo
            </span>
          )}
          <button
            onClick={triggerSoloSimulator}
            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white rounded-lg text-xs font-bold transition border border-indigo-500/40 cursor-pointer"
            title="Conecta instantaneamente um parceiro virtual com vídeo e áudio para você testar"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Simulador de Parceiro</span>
          </button>
        </div>
      </div>

      {/* Main Conversation Arena (SIDE-BY-SIDE VIDEO PANELS) */}
      <div className="relative flex-1 bg-zinc-950 p-2 sm:p-4 flex items-center justify-center overflow-hidden">
        <div className="w-full h-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-stretch">
          
          {/* LEFT PANEL: Você (Local User Video) */}
          <div className="relative bg-zinc-900 border-2 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col group min-h-[220px]">
            {/* Video Container */}
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform scale-x-[-1] ${isVideoDisabled ? 'hidden' : ''}`}
              />
              {isVideoDisabled && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 p-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-2">
                    <VideoOff className="w-8 h-8 text-zinc-400" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-400">Sua câmera está desativada</span>
                </div>
              )}

              {/* Local Header Badge */}
              <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-xl text-xs font-bold text-white border border-white/10 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Você ({user?.username || 'Usuário'})</span>
                <span className="font-mono text-emerald-400 text-[11px] font-semibold">{user?.unique_code}</span>
              </div>

              {/* Local Mic Status Badge */}
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-xl text-xs border border-white/10">
                {isMicMuted ? (
                  <span className="flex items-center gap-1 text-red-400 font-semibold text-[11px]">
                    <MicOff className="w-3.5 h-3.5" /> Mutado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                    <Mic className="w-3.5 h-3.5 animate-pulse" /> Áudio Ligado
                  </span>
                )}
              </div>

              {/* Local Bottom Info */}
              <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-[10px] text-zinc-300 font-medium">
                Feed Local • Câmera HD
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Parceiro (Remote User Video) */}
          <div className="relative bg-zinc-900 border-2 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[220px]">
            {rouletteState === 'connected' && remoteStream ? (
              <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Remote Header Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-xl text-xs font-bold text-white border border-white/10 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{currentPeer?.username || 'Parceiro'}</span>
                  {currentPeer?.country && <span>{currentPeer.country}</span>}
                  <span className="font-mono text-emerald-400 text-[11px] font-bold">
                    {currentPeer?.unique_code}
                  </span>
                </div>

                {/* Remote Connection State */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 backdrop-blur-md rounded-xl text-xs font-bold text-emerald-300 border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>P2P Conectado</span>
                </div>

                {/* Remote Bottom Controls: Denunciar */}
                <div className="absolute bottom-3 right-3">
                  <button
                    onClick={() => onReportUser(currentPeer?.unique_code || '', currentPeer?.username || 'Usuário')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/70 hover:bg-red-900 text-red-300 rounded-xl text-xs font-bold border border-red-500/40 backdrop-blur-md transition shadow-md cursor-pointer"
                    title="Denunciar este usuário"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Denunciar</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Waiting / Searching State in Right Panel */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/80">
                {rouletteState === 'searching' ? (
                  <div className="space-y-4 max-w-sm">
                    <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-2 border-indigo-500/50 animate-ping" />
                      <div className="absolute inset-2 rounded-full border-2 border-emerald-500/60 animate-pulse" />
                      <Compass className="w-10 h-10 text-indigo-400 animate-spin" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Buscando Parceiro Global...</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Conectando à fila WebRTC. Assim que outro usuário for emparelhado, o vídeo aparecerá aqui lado a lado!
                    </p>
                    <button
                      onClick={stopSearching}
                      className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Cancelar Busca
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 max-w-sm">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center mx-auto shadow-xl shadow-indigo-600/30">
                      <Radio className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-xl font-extrabold text-white">Roleta de Vídeo Lado a Lado</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Seu vídeo e o do parceiro serão transmitidos simultaneamente em alta resolução. Pressione o botão verde para iniciar!
                    </p>
                    <button
                      onClick={() => startSearching()}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/30 transition transform hover:scale-105 active:scale-95 text-xs flex items-center gap-2 mx-auto cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Iniciar Roleta Global</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Floating Emoji Reactions Overlay */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          {floatingEmojis.map((item) => (
            <div
              key={item.id}
              style={{ left: `${item.x}%` }}
              className="absolute bottom-20 text-5xl animate-bounce transition-all duration-1000 ease-out"
            >
              {item.emoji}
            </div>
          ))}
        </div>

        {/* In-Call Text Chat Drawer */}
        {isChatOpen && (
          <div className="absolute right-3 top-3 bottom-3 w-80 max-w-[calc(100%-24px)] bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl z-30 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span>Chat com Parceiro</span>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800 cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Messages List */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 italic text-[11px]">
                  Nenhuma mensagem ainda. Envie uma mensagem no chat!
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.isSelf ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[10px] text-zinc-400 mb-0.5">
                      {m.sender_name} • {m.timestamp}
                    </span>
                    <div
                      className={`px-3 py-2 rounded-2xl max-w-[85%] break-words ${
                        m.isSelf
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-700/60'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Reactions Bar in Chat */}
            <div className="px-3 py-1.5 border-t border-zinc-800 bg-zinc-950/60 flex justify-between">
              {['❤️', '😂', '🔥', '👏', '👋', '🤩'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="hover:scale-125 transition text-base cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Input form */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800 flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Floating Bottom Control Dock */}
      <div className="bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 px-4 py-3 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Left Quick Reactions */}
          <div className="hidden sm:flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            {['👋', '❤️', '😂', '🔥', '👏'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="w-8 h-8 flex items-center justify-center hover:bg-zinc-800 rounded-lg text-base transition transform active:scale-125 cursor-pointer"
                title={`Reagir ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Center Main Actions */}
          <div className="flex items-center gap-2 sm:gap-3 mx-auto">
            {rouletteState === 'idle' ? (
              <button
                onClick={() => startSearching()}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Iniciar Roleta</span>
              </button>
            ) : rouletteState === 'searching' ? (
              <button
                onClick={stopSearching}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-red-400 font-bold rounded-2xl transition flex items-center gap-2 text-xs sm:text-sm border border-zinc-700 cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Cancelar Busca</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleNextUser}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 text-xs sm:text-sm transform hover:scale-105 active:scale-95 cursor-pointer"
                  title="Pular para o próximo usuário imediatamente"
                >
                  <SkipForward className="w-4 h-4" />
                  <span>Próximo Parceiro</span>
                </button>

                <button
                  onClick={handleDisconnect}
                  className="px-4 py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-600/30 transition flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
                  title="Encerrar conexão"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline">Desconectar</span>
                </button>
              </>
            )}

            {/* Media Toggles */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 p-1 rounded-2xl">
              <button
                onClick={toggleMic}
                className={`p-2.5 rounded-xl transition cursor-pointer ${
                  isMicMuted
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
                title={isMicMuted ? 'Ativar microfone' : 'Silenciar microfone'}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                onClick={toggleVideo}
                className={`p-2.5 rounded-xl transition cursor-pointer ${
                  isVideoDisabled
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
                title={isVideoDisabled ? 'Ligar câmera' : 'Desligar câmera'}
              >
                {isVideoDisabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`relative p-2.5 rounded-xl transition cursor-pointer ${
                  isChatOpen
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
                title="Abrir Chat de Texto"
              >
                <MessageSquare className="w-4 h-4" />
                {messages.length > 0 && !isChatOpen && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
