import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { socketService } from '../services/socket.ts';
import { WebRTCManager, createMockPeerStream } from '../services/webrtc.ts';
import { sounds } from '../services/audio.ts';
import { localDb } from '../services/localDatabase.ts';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Delete,
  Search,
  Users,
  Flag,
  MessageSquare,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  BellRing,
  Volume2,
} from 'lucide-react';

interface DirectCallViewProps {
  onReportUser: (code: string, name: string) => void;
  activeIncomingCallSession?: any;
  onClearIncomingSession?: () => void;
  onTriggerTestIncomingCall?: () => void;
}

interface TargetUserPreview {
  id: string;
  unique_code: string;
  username: string;
  avatar?: string;
  country?: string;
  bio?: string;
  status: 'online' | 'busy' | 'offline' | 'banned';
}

export const DirectCallView: React.FC<DirectCallViewProps> = ({
  onReportUser,
  activeIncomingCallSession,
  onClearIncomingSession,
  onTriggerTestIncomingCall,
}) => {
  const { user } = useAuth();
  const socket = socketService.getSocket();

  // Dial input state
  const [dialCode, setDialCode] = useState('');
  const [targetPreview, setTargetPreview] = useState<TargetUserPreview | null>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [dialError, setDialError] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<
    { id: string; username: string; unique_code: string; country?: string; avatar?: string }[]
  >([]);

  // Call status: 'idle' | 'calling' | 'connected'
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected'>('idle');
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [remotePeerSocketId, setRemotePeerSocketId] = useState<string | null>(null);
  const [activeCallPartner, setActiveCallPartner] = useState<{
    id: string;
    username: string;
    unique_code: string;
    avatar?: string;
    country?: string;
  } | null>(null);

  // Duration timer
  const [callDuration, setCallDuration] = useState(0);

  // Media
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);

  // In-call chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<
    { id: string; sender_name: string; text: string; timestamp: string; isSelf: boolean }[]
  >([]);
  const [inputText, setInputText] = useState('');

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const timerRef = useRef<any>(null);

  // Directory of contacts for quick dialing
  const quickDirectory = [
    { code: '#CR-849201', name: 'Lucas Silva', country: 'Brasil 🇧🇷', role: 'Dev & Games' },
    { code: '#CR-193852', name: 'Sofia Martinez', country: 'Portugal 🇵🇹', role: 'Design & Foto' },
    { code: '#CR-552910', name: 'Clara Costa', country: 'Espanha 🇪🇸', role: 'Idiomas' },
    { code: '#CR-648291', name: 'Alex Morgan', country: 'EUA 🇺🇸', role: 'Música' },
    { code: '#CR-000001', name: 'Admin Master', country: 'Brasil 🇧🇷', role: 'Administrador' },
  ];

  // Initialize media
  const initMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (e) {
      console.warn('Physical camera unavailable, using virtual test stream');
      const mockStream = createMockPeerStream(user?.username || 'Você');
      setLocalStream(mockStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mockStream;
      }
      return mockStream;
    }
  };

  useEffect(() => {
    initMedia();
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      if (webrtcRef.current) {
        webrtcRef.current.close();
      }
      sounds.stopAll();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle active incoming call accepted from modal
  useEffect(() => {
    if (activeIncomingCallSession) {
      console.log('[DirectCall] Accepted incoming call session received:', activeIncomingCallSession);
      sounds.stopAll();
      sounds.playConnectedChime();
      setCallStatus('connected');
      setCurrentCallId(activeIncomingCallSession.callId);
      setActiveCallPartner(activeIncomingCallSession.caller);
      setRemotePeerSocketId(activeIncomingCallSession.callerSocketId);

      const setupReceiverRtc = async () => {
        let activeStream = localStream;
        if (!activeStream) {
          activeStream = await initMedia();
        }

        const rtc = new WebRTCManager({
          onRemoteStream: (stream) => {
            console.log('[DirectCall] Receiver got remote stream tracks:', stream.getTracks().length);
            setRemoteStream(stream);
          },
          onIceCandidate: (candidate) => {
            socket.emit('webrtc:ice_candidate', {
              toSocketId: activeIncomingCallSession.callerSocketId,
              candidate,
              roomId: `direct_room_${activeIncomingCallSession.callId}`,
            });
          },
        });
        webrtcRef.current = rtc;
        rtc.initConnection(activeStream);
      };

      if (!activeIncomingCallSession.isMock && activeIncomingCallSession.callerSocketId !== 'mock_caller') {
        setupReceiverRtc();
      } else {
        const mockStream = createMockPeerStream(activeIncomingCallSession.caller.username);
        setRemoteStream(mockStream);
        setMessages([
          {
            id: 'mock_welcome',
            sender_name: activeIncomingCallSession.caller.username,
            text: 'Olá! Que bom que atendeu a chamada. O áudio e vídeo estão funcionando perfeitamente!',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSelf: false,
          },
        ]);
      }
    }
  }, [activeIncomingCallSession]);

  // Update remote video
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((e) => console.log('Autoplay handled:', e));
    }
  }, [remoteStream]);

  // Duration timer when connected
  useEffect(() => {
    if (callStatus === 'connected') {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // Cleanup helper
  const cleanupCall = () => {
    sounds.stopAll();
    if (webrtcRef.current) {
      webrtcRef.current.close();
      webrtcRef.current = null;
    }
    setRemoteStream(null);
    setCallStatus('idle');
    setCurrentCallId(null);
    setRemotePeerSocketId(null);
    setActiveCallPartner(null);
    setMessages([]);
    if (onClearIncomingSession) onClearIncomingSession();
  };

  // Socket Direct Call Listeners & BroadcastChannel
  useEffect(() => {
    const onCallRinging = (data: { callId: string; targetUser: any }) => {
      console.log('[DirectCall] Ringing (Outgoing):', data);
      sounds.unlockAudio();
      sounds.startOutgoingRing();
      setCallStatus('calling');
      setCurrentCallId(data.callId);
      setActiveCallPartner(data.targetUser);
    };

    const onCallAccepted = async (data: {
      callId: string;
      roomId: string;
      peerSocketId: string;
      isInitiator: boolean;
      isAutoAttendant?: boolean;
      peer?: any;
    }) => {
      console.log('[DirectCall] Accepted:', data);
      sounds.stopAll();
      sounds.playConnectedChime();
      setCallStatus('connected');
      setCurrentCallId(data.callId);
      setRemotePeerSocketId(data.peerSocketId);

      if (data.isAutoAttendant && data.peer) {
        setActiveCallPartner(data.peer);
        const mockStream = createMockPeerStream(data.peer.username);
        setRemoteStream(mockStream);
        setMessages([
          {
            id: 'auto_msg_1',
            sender_name: data.peer.username,
            text: 'Olá! Conexão estabelecida com sucesso. Como posso ajudar você hoje?',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSelf: false,
          },
        ]);
        return;
      }

      const rtc = new WebRTCManager({
        onRemoteStream: (stream) => {
          setRemoteStream(stream);
        },
        onIceCandidate: (candidate) => {
          socket.emit('webrtc:ice_candidate', {
            toSocketId: data.peerSocketId,
            candidate,
            roomId: data.roomId,
          });
        },
      });

      webrtcRef.current = rtc;
      rtc.initConnection(localStream);

      if (data.isInitiator) {
        try {
          const offer = await rtc.createOffer();
          socket.emit('webrtc:offer', {
            toSocketId: data.peerSocketId,
            sdp: offer,
            roomId: data.roomId,
          });
        } catch (e) {
          console.error('Error creating offer:', e);
        }
      }
    };

    // WebRTC Signaling Handlers (P2P Handshake)
    const handleWebRTCOffer = async (payload: { fromSocketId: string; sdp: any; roomId?: string }) => {
      console.log('[DirectCall] Received WebRTC offer from:', payload.fromSocketId);
      if (!webrtcRef.current) {
        let activeStream = localStream;
        if (!activeStream) activeStream = await initMedia();
        const rtc = new WebRTCManager({
          onRemoteStream: (stream) => {
            console.log('[DirectCall] Remote stream tracks received:', stream.getTracks().length);
            setRemoteStream(stream);
          },
          onIceCandidate: (candidate) => {
            socket.emit('webrtc:ice_candidate', {
              toSocketId: payload.fromSocketId,
              candidate,
              roomId: payload.roomId,
            });
          },
        });
        webrtcRef.current = rtc;
        rtc.initConnection(activeStream);
      }
      try {
        const answer = await webrtcRef.current.handleOffer(payload.sdp);
        socket.emit('webrtc:answer', {
          toSocketId: payload.fromSocketId,
          sdp: answer,
          roomId: payload.roomId,
        });
      } catch (err) {
        console.error('[DirectCall] Error handling offer:', err);
      }
    };

    const handleWebRTCAnswer = async (payload: { fromSocketId: string; sdp: any }) => {
      console.log('[DirectCall] Received WebRTC answer from:', payload.fromSocketId);
      if (webrtcRef.current) {
        try {
          await webrtcRef.current.handleAnswer(payload.sdp);
        } catch (err) {
          console.error('[DirectCall] Error handling answer:', err);
        }
      }
    };

    const handleWebRTCIceCandidate = async (payload: { fromSocketId: string; candidate: any }) => {
      if (webrtcRef.current) {
        try {
          await webrtcRef.current.addIceCandidate(payload.candidate);
        } catch (err) {
          console.warn('[DirectCall] Error adding candidate:', err);
        }
      }
    };

    const onOnlineList = (list: any[]) => {
      if (Array.isArray(list)) {
        setOnlineUsers(list.filter((u) => u.unique_code !== user?.unique_code));
      }
    };

    const onCallRejected = (data: { callId: string; reason: string }) => {
      console.log('[DirectCall] Rejected:', data);
      sounds.stopAll();
      sounds.playHangupTone();
      setDialError(`Chamada recusada: ${data.reason || 'O usuário não atendeu.'}`);
      cleanupCall();
    };

    const onCallEnded = (data: { reason?: string }) => {
      console.log('[DirectCall] Ended:', data);
      sounds.stopAll();
      sounds.playHangupTone();
      cleanupCall();
    };

    const onCallError = (data: { message: string }) => {
      sounds.stopAll();
      setDialError(data.message);
      cleanupCall();
    };

    // Cross-tab broadcast responses
    const onBroadcastAccepted = (payload: { callId: string; receiverCode?: string }) => {
      sounds.stopAll();
      sounds.playConnectedChime();
      setCallStatus('connected');
      if (!remoteStream) {
        const mockStream = createMockPeerStream(targetPreview?.username || 'Usuário Remoto');
        setRemoteStream(mockStream);
      }
    };

    const onBroadcastRejected = () => {
      sounds.stopAll();
      sounds.playHangupTone();
      setDialError('Chamada recusada na outra aba.');
      cleanupCall();
    };

    socket.on('call:ringing', onCallRinging);
    socket.on('call:accepted', onCallAccepted);
    socket.on('call:rejected', onCallRejected);
    socket.on('call:ended', onCallEnded);
    socket.on('call:error', onCallError);
    socket.on('webrtc:offer', handleWebRTCOffer);
    socket.on('webrtc:answer', handleWebRTCAnswer);
    socket.on('webrtc:ice_candidate', handleWebRTCIceCandidate);
    socket.on('presence:online_list', onOnlineList);

    socketService.onLocal('call:accepted_broadcast', onBroadcastAccepted);
    socketService.onLocal('call:rejected_broadcast', onBroadcastRejected);

    // Request active online users
    socket.emit('presence:request_online_list');

    return () => {
      socket.off('call:ringing', onCallRinging);
      socket.off('call:accepted', onCallAccepted);
      socket.off('call:rejected', onCallRejected);
      socket.off('call:ended', onCallEnded);
      socket.off('call:error', onCallError);
      socket.off('webrtc:offer', handleWebRTCOffer);
      socket.off('webrtc:answer', handleWebRTCAnswer);
      socket.off('webrtc:ice_candidate', handleWebRTCIceCandidate);
      socket.off('presence:online_list', onOnlineList);

      socketService.offLocal('call:accepted_broadcast', onBroadcastAccepted);
      socketService.offLocal('call:rejected_broadcast', onBroadcastRejected);
    };
  }, [localStream, socket, targetPreview]);

  // Lookup target user by unique code
  useEffect(() => {
    const code = dialCode.trim();
    if (code.length >= 7) {
      setIsSearchingUser(true);
      const clean = code.startsWith('#') ? code : `#${code}`;
      fetch(`/api/users/by-code/${encodeURIComponent(clean)}`)
        .then((res) => {
          const contentType = res.headers.get('content-type');
          if (res.ok && contentType && contentType.includes('application/json')) {
            return res.json();
          }
          return null;
        })
        .then((data) => {
          if (data?.user) {
            setTargetPreview(data.user);
            setDialError(null);
          } else {
            // Local fallback
            const localUser = localDb.getUserByCode(clean);
            if (localUser) {
              setTargetPreview({ ...localUser, status: 'online' });
              setDialError(null);
            } else {
              setTargetPreview(null);
            }
          }
        })
        .catch(() => {
          const localUser = localDb.getUserByCode(clean);
          if (localUser) {
            setTargetPreview({ ...localUser, status: 'online' });
            setDialError(null);
          } else {
            setTargetPreview(null);
          }
        })
        .finally(() => setIsSearchingUser(false));
    } else {
      setTargetPreview(null);
    }
  }, [dialCode]);

  // Initiate call
  const handleDial = (type: 'video' | 'audio' = 'video', overrideCode?: string) => {
    setDialError(null);
    const codeToDial = overrideCode || dialCode;
    if (!codeToDial.trim()) {
      setDialError('Digite um código de usuário válido.');
      return;
    }

    const cleanCode = codeToDial.trim().startsWith('#')
      ? codeToDial.trim().toUpperCase()
      : `#${codeToDial.trim().toUpperCase()}`;

    if (user && user.unique_code.toUpperCase() === cleanCode) {
      setDialError('Você não pode ligar para o seu próprio código.');
      return;
    }

    setDialCode(cleanCode);
    setCallStatus('calling');
    sounds.unlockAudio();
    sounds.startOutgoingRing();

    // 1. Emit to server socket with caller info
    socket.emit('call:dial', {
      targetCode: cleanCode,
      callType: type,
      callerInfo: user
        ? {
            id: user.id,
            username: user.username,
            unique_code: user.unique_code,
            avatar: user.avatar,
            country: user.country,
          }
        : undefined,
    });

    // 2. Broadcast across tabs in same browser (so second open tab rings immediately!)
    socketService.broadcastLocal('call:incoming_broadcast', {
      targetCode: cleanCode,
      callId: `call_${Date.now()}_local`,
      callerSocketId: socket.id || 'local_tab',
      caller: {
        id: user?.id || 'guest',
        username: user?.username || 'Usuário',
        unique_code: user?.unique_code || '',
        avatar: user?.avatar,
        country: user?.country,
      },
      callType: type,
    });
  };

  // Hangup call
  const handleHangup = () => {
    sounds.playHangupTone();
    socket.emit('call:hangup', {
      callId: currentCallId || undefined,
      targetSocketId: remotePeerSocketId || undefined,
    });
    cleanupCall();
  };

  // Dial pad button press
  const handlePadPress = (val: string) => {
    setDialError(null);
    if (val === 'DEL') {
      setDialCode((prev) => prev.slice(0, -1));
    } else if (val === 'CLR') {
      setDialCode('');
    } else {
      setDialCode((prev) => {
        let next = prev + val;
        // Auto-prefix with #CR- if typing digits
        if (!next.startsWith('#')) {
          if (next.startsWith('CR')) {
            next = '#' + next;
          } else if (/^\d/.test(next)) {
            next = '#CR-' + next;
          }
        }
        return next;
      });
    }
  };

  // Toggle Mute
  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle Video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  // Send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');

    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        sender_name: user?.username || 'Você',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSelf: true,
      },
    ]);

    if (remotePeerSocketId && remotePeerSocketId !== 'virtual_peer' && remotePeerSocketId !== 'mock_caller') {
      socket.emit('chat:message', {
        toSocketId: remotePeerSocketId,
        text,
        senderName: user?.username || 'Usuário',
      });
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // If call is CONNECTED: Show In-Call Screen (SIDE-BY-SIDE VIDEO LAYOUT)
  if (callStatus === 'connected') {
    return (
      <div className="relative flex flex-col flex-1 h-[calc(100vh-65px)] bg-zinc-950 overflow-hidden">
        {/* Call Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-zinc-900/90 border-b border-zinc-800 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-extrabold text-white text-sm">
              Chamada Direta • Vídeos Lado a Lado
            </span>
            <span className="font-mono text-emerald-400 font-bold px-2 py-0.5 bg-emerald-500/10 rounded-md border border-emerald-500/20">
              {activeCallPartner?.unique_code || targetPreview?.unique_code || dialCode}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-zinc-300 text-xs sm:text-sm bg-zinc-800 px-3 py-1 rounded-full flex items-center gap-1.5 border border-zinc-700">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              {formatTimer(callDuration)}
            </span>
            <button
              onClick={() =>
                onReportUser(
                  activeCallPartner?.unique_code || targetPreview?.unique_code || dialCode,
                  activeCallPartner?.username || targetPreview?.username || 'Usuário'
                )
              }
              className="flex items-center gap-1 px-3 py-1 bg-red-950/40 hover:bg-red-900/50 text-red-300 rounded-lg text-xs font-semibold border border-red-500/30 cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Denunciar</span>
            </button>
          </div>
        </div>

        {/* Video Canvas Arena (SIDE-BY-SIDE DUAL PANELS) */}
        <div className="relative flex-1 bg-zinc-950 p-2 sm:p-4 flex items-center justify-center overflow-hidden">
          <div className="w-full h-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-stretch">
            {/* LEFT PANEL: Você (Local User) */}
            <div className="relative bg-zinc-900 border-2 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[220px]">
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

                {/* Local Mic Badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-xl text-xs border border-white/10">
                  {isMicMuted ? (
                    <span className="flex items-center gap-1 text-red-400 font-semibold text-[11px]">
                      <MicOff className="w-3.5 h-3.5" /> Mutado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                      <Mic className="w-3.5 h-3.5 animate-pulse" /> Áudio Ativo
                    </span>
                  )}
                </div>

                <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-[10px] text-zinc-300 font-medium">
                  Feed Local • Transmissão Direta
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: Destinatário (Remote Partner) */}
            <div className="relative bg-zinc-900 border-2 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[220px]">
              <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                {remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 p-6 text-center">
                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-3 animate-pulse">
                      <Video className="w-8 h-8 text-emerald-400" />
                    </div>
                    <p className="font-bold text-white text-sm">Conexão Direta Ativa</p>
                    <p className="text-xs text-zinc-500 mt-1">Sincronizando vídeo do destinatário...</p>
                  </div>
                )}

                {/* Remote Header Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-xl text-xs font-bold text-white border border-white/10 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{activeCallPartner?.username || targetPreview?.username || 'Destinatário'}</span>
                  {activeCallPartner?.country && <span>{activeCallPartner.country}</span>}
                  <span className="font-mono text-emerald-400 text-[11px] font-bold">
                    {activeCallPartner?.unique_code || targetPreview?.unique_code || dialCode}
                  </span>
                </div>

                {/* Remote Connection State */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 backdrop-blur-md rounded-xl text-xs font-bold text-emerald-300 border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>P2P Conectado</span>
                </div>
              </div>
            </div>
          </div>

          {/* In-Call Text Chat Drawer */}
          {isChatOpen && (
            <div className="absolute right-3 top-3 bottom-3 w-80 max-w-[calc(100%-24px)] bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl z-30 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
              <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  <span>Mensagens da Chamada</span>
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
                    Nenhuma mensagem ainda. Envie uma mensagem!
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
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800 flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Mensagem..."
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

        {/* In-Call Controls Bottom Bar */}
        <div className="bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 py-3.5 px-6 z-20">
          <div className="max-w-md mx-auto flex items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={toggleMic}
              className={`p-3.5 rounded-full transition cursor-pointer ${
                isMicMuted
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : 'bg-zinc-800 text-white hover:bg-zinc-700'
              }`}
              title={isMicMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
            >
              {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              onClick={handleHangup}
              className="px-8 py-3.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold rounded-full shadow-lg shadow-red-600/30 transition flex items-center gap-2 transform hover:scale-105 active:scale-95 cursor-pointer text-xs sm:text-sm"
            >
              <PhoneOff className="w-5 h-5" />
              <span>Desligar Chamada</span>
            </button>

            <button
              onClick={toggleVideo}
              className={`p-3.5 rounded-full transition cursor-pointer ${
                isVideoDisabled
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : 'bg-zinc-800 text-white hover:bg-zinc-700'
              }`}
              title={isVideoDisabled ? 'Ligar Câmera' : 'Desligar Câmera'}
            >
              {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`p-3.5 rounded-full transition cursor-pointer ${
                isChatOpen
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-white hover:bg-zinc-700'
              }`}
              title="Abrir Chat"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If Outgoing Call is Ringing: Show Dual Calling Screen (SIDE-BY-SIDE)
  if (callStatus === 'calling') {
    return (
      <div className="relative flex flex-col flex-1 h-[calc(100vh-65px)] bg-zinc-950 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-zinc-900/90 border-b border-zinc-800 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="font-bold text-white text-sm">
              Discando Chamada • {targetPreview?.username || activeCallPartner?.username || dialCode}
            </span>
          </div>
          <span className="text-zinc-400 text-xs flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Tocando tom telefônico...
          </span>
        </div>

        {/* Side-by-side: Local Video on Left, Calling Card on Right */}
        <div className="relative flex-1 bg-zinc-950 p-2 sm:p-4 flex items-center justify-center overflow-hidden">
          <div className="w-full h-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-stretch">
            {/* Left: Your Camera */}
            <div className="relative bg-zinc-900 border-2 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[220px]">
              <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform scale-x-[-1] ${isVideoDisabled ? 'hidden' : ''}`}
                />
                <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-xl text-xs font-bold text-white border border-white/10">
                  Você ({user?.username}) • Câmera Pronta
                </div>
              </div>
            </div>

            {/* Right: Target Ringing */}
            <div className="relative bg-zinc-900 border-2 border-indigo-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center p-6 text-center min-h-[220px]">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/30 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-indigo-500 animate-pulse" />
                <img
                  src={
                    targetPreview?.avatar ||
                    activeCallPartner?.avatar ||
                    `https://api.dicebear.com/7.x/bottts/svg?seed=${dialCode}`
                  }
                  alt="Calling avatar"
                  className="w-full h-full rounded-full object-cover border-4 border-indigo-500 shadow-2xl relative z-10"
                />
              </div>

              <h3 className="text-xl font-extrabold text-white mb-1">
                {targetPreview?.username || activeCallPartner?.username || 'Destinatário'}
              </h3>
              <p className="font-mono text-base font-black text-emerald-400 mb-2">
                {targetPreview?.unique_code || activeCallPartner?.unique_code || dialCode}
              </p>
              <p className="text-xs text-zinc-400 mb-6 flex items-center justify-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Aguardando atendimento no dispositivo do usuário...
              </p>

              <button
                onClick={handleHangup}
                className="px-8 py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full shadow-xl shadow-red-600/30 transition flex items-center gap-2 transform hover:scale-105 active:scale-95 cursor-pointer text-xs sm:text-sm"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Cancelar Chamada</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // IDLE State: Show Phone Keypad & Quick Directory & Test Helper
  return (
    <div className="flex-1 overflow-y-auto bg-zinc-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Phone Dial Pad & Simulator */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {/* Direct Incoming Call Test Banner */}
          <div className="mb-6 p-4 bg-gradient-to-r from-emerald-950/60 via-zinc-900 to-indigo-950/60 border border-emerald-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Testar Toque de Chamada</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-1.5 py-0.2 rounded border border-emerald-500/30">
                    Atender / Recusar
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Dispara o toque sonoro no seu navegador para testar a tela de chamada recebida.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onTriggerTestIncomingCall}
              className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 transition transform hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Receber Chamada Teste</span>
            </button>
          </div>

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
              <Phone className="w-3.5 h-3.5" /> Discador Estilo Telefone
            </div>
            <h2 className="text-xl font-bold text-white">Discar Código Único</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Digite o código (#CR-XXXXXX) para chamar qualquer pessoa diretamente
            </p>
          </div>

          {dialError && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-500/40 rounded-2xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{dialError}</span>
            </div>
          )}

          {/* Code Input Display */}
          <div className="relative mb-6">
            <input
              type="text"
              value={dialCode}
              onChange={(e) => setDialCode(e.target.value.toUpperCase())}
              placeholder="#CR-849201"
              className="w-full text-center font-mono text-2xl sm:text-3xl font-extrabold tracking-wider px-4 py-4 bg-zinc-950 border-2 border-zinc-700 rounded-2xl text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition shadow-inner"
            />
            {dialCode && (
              <button
                onClick={() => setDialCode('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer"
              >
                <Delete className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* User Preview Card if Code matches */}
          {targetPreview && (
            <div className="mb-6 p-4 bg-zinc-950 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <img
                  src={targetPreview.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${targetPreview.username}`}
                  alt={targetPreview.username}
                  className="w-12 h-12 rounded-xl object-cover border border-zinc-700"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm">{targetPreview.username}</h4>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        targetPreview.status === 'online'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : targetPreview.status === 'busy'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {targetPreview.status === 'online' ? '● Online' : targetPreview.status === 'busy' ? '● Ocupado' : '● Offline'}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-emerald-400">{targetPreview.unique_code}</p>
                  {targetPreview.country && (
                    <p className="text-[11px] text-zinc-400">{targetPreview.country}</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDial('video')}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Chamar</span>
              </button>
            </div>
          )}

          {/* Keypad Grid */}
          <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-6">
            {[
              { label: '1', sub: '' },
              { label: '2', sub: 'ABC' },
              { label: '3', sub: 'DEF' },
              { label: '4', sub: 'GHI' },
              { label: '5', sub: 'JKL' },
              { label: '6', sub: 'MNO' },
              { label: '7', sub: 'PQRS' },
              { label: '8', sub: 'TUV' },
              { label: '9', sub: 'WXYZ' },
              { label: '#', sub: 'CÓD' },
              { label: '0', sub: '+' },
              { label: 'DEL', sub: 'APAGAR' },
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={() => handlePadPress(btn.label)}
                className="py-3.5 sm:py-4 bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 hover:border-indigo-500/40 rounded-2xl text-white font-bold transition flex flex-col items-center justify-center shadow-sm active:scale-95 cursor-pointer"
              >
                <span className="text-xl font-mono">{btn.label}</span>
                {btn.sub && <span className="text-[9px] text-zinc-500 tracking-wider font-sans">{btn.sub}</span>}
              </button>
            ))}
          </div>

          {/* Call Action Buttons */}
          <div className="flex gap-3 max-w-sm mx-auto">
            <button
              onClick={() => handleDial('video')}
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/30 transition flex items-center justify-center gap-2 text-sm transform hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>Ligar com Vídeo</span>
            </button>

            <button
              onClick={() => handleDial('audio')}
              className="px-5 py-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white font-bold rounded-2xl border border-zinc-700 transition flex items-center justify-center gap-2 text-sm cursor-pointer"
              title="Chamada apenas de áudio"
            >
              <Phone className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Column: Online Users & Quick Directory */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Online Users (Live in Real-Time) */}
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Usuários Conectados Agora</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md font-bold border border-emerald-500/20">
                {onlineUsers.length} online
              </span>
            </div>

            {onlineUsers.length === 0 ? (
              <div className="p-4 bg-zinc-950/60 rounded-2xl border border-zinc-800 text-center">
                <p className="text-xs text-zinc-400 mb-2">
                  Nenhum outro usuário online no mesmo servidor neste segundo.
                </p>
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 text-xs font-semibold rounded-xl border border-indigo-500/30 transition cursor-pointer"
                >
                  Abrir Segunda Aba para Chamar
                </button>
              </div>
            ) : (
              <div className="space-y-2 mb-3">
                {onlineUsers.map((u) => (
                  <div
                    key={u.id}
                    className="p-3 bg-zinc-950/80 hover:bg-zinc-950 border border-emerald-500/30 rounded-2xl transition flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                        alt={u.username}
                        className="w-9 h-9 rounded-xl object-cover border border-emerald-500/40"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs">{u.username}</span>
                          {u.country && <span className="text-[10px] text-zinc-400">{u.country}</span>}
                        </div>
                        <div className="font-mono text-xs font-bold text-emerald-400">{u.unique_code}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDial('video', u.unique_code)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-md shadow-emerald-600/30 cursor-pointer"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Ligar</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Contact Directory */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-white font-bold text-sm mb-4">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Contatos da Plataforma para Chamar</span>
            </div>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Clique em qualquer contato abaixo para discar e testar o toque de chamada:
            </p>

            <div className="space-y-2.5">
              {quickDirectory.map((contact) => (
                <div
                  key={contact.code}
                  className="p-3 bg-zinc-950/70 hover:bg-zinc-950 border border-zinc-800/80 hover:border-indigo-500/50 rounded-2xl transition flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${contact.name}`}
                      alt={contact.name}
                      className="w-9 h-9 rounded-xl object-cover border border-zinc-700"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white text-xs group-hover:text-indigo-300 transition">
                          {contact.name}
                        </span>
                        <span className="text-[10px] text-zinc-400">{contact.country}</span>
                      </div>
                      <div className="font-mono text-xs font-bold text-emerald-400">
                        {contact.code}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setDialCode(contact.code);
                      setDialError(null);
                      handleDial('video', contact.code);
                    }}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Phone className="w-3 h-3" />
                    <span>Ligar</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* User's own phone card */}
          {user && (
            <div className="bg-gradient-to-br from-indigo-950/40 to-zinc-900 border border-indigo-500/30 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Seu Código Pessoal para Receber Chamadas
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="font-mono text-2xl font-black text-white mt-1 tracking-wider flex items-center justify-between">
                <span>{user.unique_code}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(user.unique_code);
                  }}
                  className="text-xs px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 rounded-lg border border-indigo-500/30 transition cursor-pointer"
                >
                  Copiar
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-2">
                Qualquer outro usuário ou janela pode discar este código no discador para fazer tocar o seu telefone com opções de Atender e Recusar!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
