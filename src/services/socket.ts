import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private currentUser: { id: string; username: string; unique_code: string } | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  public isConnected = false;
  private channelListeners = new Map<string, Set<Function>>();
  private serverAvailable = true;

  public init(): Socket {
    if (!this.socket) {
      // Determine backend origin
      const customBackend = (import.meta as any).env?.VITE_BACKEND_URL;
      const isLocalOrCloud =
        typeof window !== 'undefined' &&
        (window.location.origin.includes('localhost') ||
          window.location.origin.includes('run.app') ||
          window.location.origin.includes('3000'));

      const targetUrl = customBackend || (isLocalOrCloud ? window.location.origin : undefined);

      this.socket = io(targetUrl || window.location.origin, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 4, // Prevent infinite 404 spamming on static hosts
        reconnectionDelay: 2000,
        timeout: 5000,
        transports: ['websocket', 'polling'], // Prefer direct websocket to avoid polling 404s
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.serverAvailable = true;
        console.log('[SocketClient] Connected with id:', this.socket?.id);
        if (this.currentUser) {
          this.identify(this.currentUser);
        }
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        console.log('[SocketClient] Disconnected:', reason);
      });

      this.socket.on('connect_error', (err) => {
        this.isConnected = false;
        // If server responded with 404 (e.g. static hosting on Vercel), disable aggressive socket retries
        if (err && err.message && (err.message.includes('404') || err.message.includes('xhr poll error'))) {
          this.serverAvailable = false;
        }
      });

      // Initialize cross-tab BroadcastChannel fallback
      this.initBroadcastChannel();
    }
    return this.socket;
  }

  private initBroadcastChannel() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('chatroulette_p2p_channel');
        this.broadcastChannel.onmessage = (event) => {
          const { eventName, payload } = event.data || {};
          if (eventName && this.channelListeners.has(eventName)) {
            this.channelListeners.get(eventName)!.forEach((cb) => {
              try {
                cb(payload);
              } catch (e) {
                console.warn('Error in BroadcastChannel listener:', e);
              }
            });
          }
        };
      }
    } catch {
      // BroadcastChannel not available
    }
  }

  public getSocket(): Socket {
    if (!this.socket) {
      return this.init();
    }
    return this.socket;
  }

  public identify(user: { id: string; username: string; unique_code: string }) {
    this.currentUser = user;
    if (this.socket && this.socket.connected) {
      this.socket.emit('auth:identify', {
        userId: user.id,
        username: user.username,
        unique_code: user.unique_code,
      });
    }
    // Also broadcast presence cross-tab
    this.broadcastLocal('presence:change', {
      userId: user.id,
      unique_code: user.unique_code,
      status: 'online',
    });
  }

  public clearIdentity() {
    if (this.currentUser) {
      this.broadcastLocal('presence:change', {
        userId: this.currentUser.id,
        unique_code: this.currentUser.unique_code,
        status: 'offline',
      });
    }
    this.currentUser = null;
  }

  // Broadcast message across tabs for multi-tab testing & offline fallback
  public broadcastLocal(eventName: string, payload: any) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ eventName, payload });
      } catch {
        // ignore
      }
    }
  }

  // Subscribe to local fallback events
  public onLocal(eventName: string, callback: Function) {
    if (!this.channelListeners.has(eventName)) {
      this.channelListeners.set(eventName, new Set());
    }
    this.channelListeners.get(eventName)!.add(callback);
  }

  public offLocal(eventName: string, callback: Function) {
    if (this.channelListeners.has(eventName)) {
      this.channelListeners.get(eventName)!.delete(callback);
    }
  }
}

export const socketService = new SocketService();
