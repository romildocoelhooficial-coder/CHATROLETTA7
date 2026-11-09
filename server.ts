import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { User, Report } from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Seed Users
const initialUsers: User[] = [
  {
    id: 'user_admin_001',
    unique_code: '#CR-000001',
    username: 'Administrador Master',
    email: 'admin@chatroulette.com',
    role: 'admin',
    status: 'online',
    country: 'Brasil 🇧🇷',
    gender: 'unspecified',
    bio: 'Administrador global do ChatRoulette P2P.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'user_002',
    unique_code: '#CR-849201',
    username: 'Lucas Silva',
    email: 'lucas@exemplo.com',
    role: 'user',
    status: 'online',
    country: 'Brasil 🇧🇷',
    gender: 'male',
    bio: 'Adoro conversar sobre tecnologia, música e games!',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'user_003',
    unique_code: '#CR-193852',
    username: 'Sofia Martinez',
    email: 'sofia@exemplo.com',
    role: 'user',
    status: 'online',
    country: 'Portugal 🇵🇹',
    gender: 'female',
    bio: 'Estudante de design e fotografia. Curto conhecer pessoas do mundo.',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'user_004',
    unique_code: '#CR-648291',
    username: 'Alex Morgan',
    email: 'alex@exemplo.com',
    role: 'user',
    status: 'offline',
    country: 'Estados Unidos 🇺🇸',
    gender: 'male',
    bio: 'Musician & traveler. Say hi from anywhere!',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'user_005',
    unique_code: '#CR-552910',
    username: 'Clara Costa',
    email: 'clara@exemplo.com',
    role: 'user',
    status: 'online',
    country: 'Espanha 🇪🇸',
    gender: 'female',
    bio: '¡Hola! Vamos a practicar idiomas y charlar.',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

const initialReports: Report[] = [
  {
    id: 'rep_001',
    reporter_id: 'user_003',
    reporter_name: 'Sofia Martinez',
    reported_id: 'user_004',
    reported_name: 'Alex Morgan',
    reported_code: '#CR-648291',
    reason: 'Comportamento inadequado durante a chamada',
    details: 'Desconectou abruptamente após palavras ofensivas.',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    resolved: false,
  },
];

interface DatabaseSchema {
  users: (User & { password_hash?: string })[];
  reports: Report[];
}

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load database.json, initializing fresh', err);
  }
  const defaultDB: DatabaseSchema = {
    users: initialUsers.map((u) => ({
      ...u,
      password_hash: u.role === 'admin' ? 'admin123' : 'user123',
    })),
    reports: initialReports,
  };
  saveDatabase(defaultDB);
  return defaultDB;
}

function saveDatabase(db: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database.json', err);
  }
}

let db = loadDatabase();

// Generate unique identification code: #CR-XXXXXX
function generateUniqueCode(): string {
  let code = '';
  let exists = true;
  while (exists) {
    const num = Math.floor(100000 + Math.random() * 900000);
    code = `#CR-${num}`;
    exists = db.users.some((u) => u.unique_code === code);
  }
  return code;
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  app.use(express.json());

  // Enable CORS for all incoming requests (Vercel, custom domains, local)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Socket Tracking Maps
  // userId -> Set of socketIds
  const userSockets = new Map<string, Set<string>>();
  // unique_code -> Set of socketIds (for direct dialing by code #CR-XXXXXX)
  const codeSockets = new Map<string, Set<string>>();
  // socketId -> userId
  const socketUsers = new Map<string, string>();
  // socketId -> user details cache
  const socketData = new Map<string, { userId: string; username: string; unique_code: string }>();

  // Roulette waiting queue: array of { socketId, userId, countryPreference, joinedAt }
  type QueueItem = { socketId: string; userId: string; filter?: string; joinedAt: number };
  let rouletteQueue: QueueItem[] = [];

  // Active rooms: roomId -> Set of socketIds
  const activeRooms = new Map<string, Set<string>>();
  // Active Direct Calls: callId -> { callerSocketId, receiverSocketId, callerCode, receiverCode, startTime }
  const activeCalls = new Map<
    string,
    { callerSocketId: string; receiverSocketId: string; callerCode: string; receiverCode: string; startTime: number }
  >();

  // Helper to broadcast presence update
  function broadcastUserPresence(userId: string, status: User['status'] | string) {
    io.emit('presence:change', { userId, status });
  }

  // Helper to broadcast online users list
  function broadcastOnlineUsers() {
    const onlineList: { id: string; username: string; unique_code: string; country?: string; avatar?: string }[] = [];
    const seenUsers = new Set<string>();
    for (const [socketId, data] of socketData.entries()) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock && sock.connected && !seenUsers.has(data.userId)) {
        seenUsers.add(data.userId);
        const user = db.users.find((u) => u.id === data.userId);
        onlineList.push({
          id: data.userId,
          username: data.username,
          unique_code: data.unique_code,
          country: user?.country,
          avatar: user?.avatar,
        });
      }
    }
    io.emit('presence:online_list', onlineList);
  }

  // --- REST API ROUTES ---

  // Auth: Register
  app.post('/api/auth/register', (req, res) => {
    const { username, email, password, country, gender, bio } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Nome de usuário, email e senha são obrigatórios.' });
    }

    const existingEmail = db.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (existingEmail) {
      return res.status(400).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
    }

    const uniqueCode = generateUniqueCode();
    const newUser: User & { password_hash: string } = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      unique_code: uniqueCode,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password_hash: password,
      role: 'user',
      status: 'online',
      country: country || 'Brasil 🇧🇷',
      gender: gender || 'unspecified',
      bio: bio || '',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      created_at: new Date().toISOString(),
    };

    db.users.push(newUser);
    saveDatabase(db);

    const { password_hash, ...safeUser } = newUser;
    return res.status(201).json({
      user: safeUser,
      token: safeUser.id,
      message: 'Usuário cadastrado com sucesso!',
    });
  });

  // Auth: Login (accepts email or unique_code)
  app.post('/api/auth/login', (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identificador (e-mail ou código) e senha são obrigatórios.' });
    }

    const cleanId = identifier.trim().toLowerCase();
    const user = db.users.find(
      (u) =>
        u.email.toLowerCase() === cleanId ||
        u.unique_code.toLowerCase() === cleanId
    );

    if (!user || user.password_hash !== password) {
      return res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail/código e senha.' });
    }

    if (user.status === 'banned') {
      return res.status(403).json({
        error: `Sua conta foi suspensa pela moderação. Motivo: ${user.ban_reason || 'Violação dos termos de uso'}.`,
        banned: true,
      });
    }

    // Set status to online
    user.status = 'online';
    saveDatabase(db);
    broadcastUserPresence(user.id, 'online');

    const { password_hash, ...safeUser } = user;
    return res.json({
      user: safeUser,
      token: safeUser.id,
      message: 'Login realizado com sucesso!',
    });
  });

  // Auth: Get current user
  app.get('/api/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido.' });
    }

    const user = db.users.find((u) => u.id === token);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const { password_hash, ...safeUser } = user;
    return res.json({ user: safeUser });
  });

  // Search User by Unique Code (for Phone dialer preview)
  app.get('/api/users/by-code/:code', (req, res) => {
    const rawCode = req.params.code.trim().toUpperCase();
    const formattedCode = rawCode.startsWith('#') ? rawCode : `#${rawCode}`;

    const user = db.users.find((u) => u.unique_code.toUpperCase() === formattedCode);
    if (!user) {
      return res.status(404).json({ error: `Nenhum usuário encontrado com o código ${formattedCode}.` });
    }

    const isConnected = userSockets.has(user.id) && userSockets.get(user.id)!.size > 0;

    return res.json({
      user: {
        id: user.id,
        unique_code: user.unique_code,
        username: user.username,
        avatar: user.avatar,
        country: user.country,
        bio: user.bio,
        status: user.status === 'banned' ? 'banned' : isConnected ? 'online' : 'offline',
      },
    });
  });

  // Submit Report
  app.post('/api/reports', (req, res) => {
    const { reporterId, reportedCode, reason, details } = req.body;
    if (!reporterId || !reportedCode || !reason) {
      return res.status(400).json({ error: 'Dados incompletos para denúncia.' });
    }

    const reporter = db.users.find((u) => u.id === reporterId);
    const reported = db.users.find((u) => u.unique_code.toUpperCase() === reportedCode.trim().toUpperCase());

    if (!reported) {
      return res.status(404).json({ error: 'Usuário denunciado não encontrado.' });
    }

    const newReport: Report = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reporter_id: reporterId,
      reporter_name: reporter ? reporter.username : 'Anônimo',
      reported_id: reported.id,
      reported_name: reported.username,
      reported_code: reported.unique_code,
      reason: reason.trim(),
      details: details ? details.trim() : '',
      created_at: new Date().toISOString(),
      resolved: false,
    };

    db.reports.unshift(newReport);
    saveDatabase(db);

    // Notify admins via socket if any are connected
    io.emit('admin:new_report', newReport);

    return res.status(201).json({ message: 'Denúncia recebida com sucesso. Nossa moderação analisará o caso.', report: newReport });
  });

  // --- ADMIN REST API ROUTES ---
  // Middleware check for admin token
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = db.users.find((u) => u.id === token);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso restrito a administradores do sistema.' });
    }
    next();
  };

  // Admin Metrics
  app.get('/api/admin/metrics', requireAdmin, (_req, res) => {
    let onlineCount = 0;
    for (const [userId, sockets] of userSockets.entries()) {
      if (sockets.size > 0) {
        const u = db.users.find((x) => x.id === userId);
        if (u && u.status !== 'banned') onlineCount++;
      }
    }

    const metrics = {
      totalUsers: db.users.length,
      onlineUsers: onlineCount,
      activeCalls: activeCalls.size + activeRooms.size,
      bannedUsers: db.users.filter((u) => u.status === 'banned').length,
      pendingReports: db.reports.filter((r) => !r.resolved).length,
      rouletteQueueSize: rouletteQueue.length,
    };
    return res.json(metrics);
  });

  // Admin Users List with pagination & search
  app.get('/api/admin/users', requireAdmin, (req, res) => {
    const search = ((req.query.search as string) || '').toLowerCase().trim();
    const statusFilter = (req.query.status as string) || 'all';
    const roleFilter = (req.query.role as string) || 'all';
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '10', 10);

    let filtered = db.users.map((u) => {
      const isOnline = userSockets.has(u.id) && userSockets.get(u.id)!.size > 0;
      const computedStatus = u.status === 'banned' ? 'banned' : isOnline ? 'online' : u.status;
      const { password_hash, ...safe } = u;
      return { ...safe, is_connected: isOnline, status: computedStatus };
    });

    if (search) {
      filtered = filtered.filter(
        (u) =>
          u.username.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search) ||
          u.unique_code.toLowerCase().includes(search)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((u) => u.status === statusFilter);
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return res.json({
      users: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  });

  // Admin Create User
  app.post('/api/admin/users', requireAdmin, (req, res) => {
    const { username, email, password, role, country, gender, bio } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }

    const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'E-mail já está em uso.' });
    }

    const newUser: User & { password_hash: string } = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      unique_code: generateUniqueCode(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password_hash: password,
      role: role === 'admin' ? 'admin' : 'user',
      status: 'offline',
      country: country || 'Brasil 🇧🇷',
      gender: gender || 'unspecified',
      bio: bio || '',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      created_at: new Date().toISOString(),
    };

    db.users.unshift(newUser);
    saveDatabase(db);

    const { password_hash, ...safeUser } = newUser;
    return res.status(201).json({ user: safeUser, message: 'Usuário criado com sucesso!' });
  });

  // Admin Update User
  app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { username, email, role, status, country, bio, password } = req.body;

    const userIndex = db.users.findIndex((u) => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const current = db.users[userIndex];
    if (username) current.username = username.trim();
    if (email) current.email = email.trim().toLowerCase();
    if (role) current.role = role;
    if (status) current.status = status;
    if (country) current.country = country;
    if (bio !== undefined) current.bio = bio;
    if (password) current.password_hash = password;

    saveDatabase(db);

    const { password_hash, ...safeUser } = current;
    return res.json({ user: safeUser, message: 'Usuário atualizado com sucesso!' });
  });

  // Admin Ban / Unban User
  app.post('/api/admin/users/:id/ban', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { action, reason } = req.body; // action: 'ban' | 'unban'

    const user = db.users.find((u) => u.id === id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (action === 'ban') {
      user.status = 'banned';
      user.ban_reason = reason || 'Violação das regras de conduta';

      // Terminate any active connections and calls
      const sockets = userSockets.get(user.id);
      if (sockets) {
        for (const sId of sockets) {
          io.to(sId).emit('user:banned', { reason: user.ban_reason });
          const socket = io.sockets.sockets.get(sId);
          if (socket) socket.disconnect(true);
        }
      }
      // Remove from queue
      rouletteQueue = rouletteQueue.filter((q) => q.userId !== user.id);
    } else {
      user.status = 'offline';
      user.ban_reason = undefined;
    }

    saveDatabase(db);
    broadcastUserPresence(user.id, user.status);

    return res.json({
      message: action === 'ban' ? 'Usuário banido com sucesso.' : 'Usuário desbanido com sucesso.',
      user: { id: user.id, status: user.status, ban_reason: user.ban_reason },
    });
  });

  // Admin Delete User
  app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const index = db.users.findIndex((u) => u.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const deleted = db.users.splice(index, 1)[0];
    saveDatabase(db);

    // Disconnect user socket if online
    const sockets = userSockets.get(id);
    if (sockets) {
      for (const sId of sockets) {
        io.to(sId).emit('user:deleted');
        const s = io.sockets.sockets.get(sId);
        if (s) s.disconnect(true);
      }
      userSockets.delete(id);
    }

    return res.json({ message: `Usuário ${deleted.username} deletado com sucesso.` });
  });

  // Admin Reports List
  app.get('/api/admin/reports', requireAdmin, (_req, res) => {
    return res.json({ reports: db.reports });
  });

  // Admin Resolve Report
  app.post('/api/admin/reports/:id/resolve', requireAdmin, (req, res) => {
    const { id } = req.params;
    const report = db.reports.find((r) => r.id === id);
    if (!report) {
      return res.status(404).json({ error: 'Denúncia não encontrada.' });
    }

    report.resolved = true;
    saveDatabase(db);
    return res.json({ message: 'Denúncia marcada como resolvida.', report });
  });

  // --- SOCKET.IO REAL-TIME SIGNALING & MATCHMAKING ---

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket Connected] ID: ${socket.id}`);

    // Auth Identification
    socket.on('auth:identify', (data: { userId: string; username: string; unique_code: string }) => {
      if (!data?.userId) return;

      const user = db.users.find((u) => u.id === data.userId);
      if (user?.status === 'banned') {
        socket.emit('user:banned', { reason: user.ban_reason });
        socket.disconnect();
        return;
      }

      const code = (data.unique_code || user?.unique_code || '').toUpperCase();

      socketUsers.set(socket.id, data.userId);
      socketData.set(socket.id, {
        userId: data.userId,
        username: data.username || user?.username || 'Usuário',
        unique_code: code,
      });

      if (!userSockets.has(data.userId)) {
        userSockets.set(data.userId, new Set());
      }
      userSockets.get(data.userId)!.add(socket.id);

      if (code) {
        if (!codeSockets.has(code)) {
          codeSockets.set(code, new Set());
        }
        codeSockets.get(code)!.add(socket.id);
      }

      // Broadcast user online status and full active directory
      broadcastUserPresence(data.userId, 'online');
      broadcastOnlineUsers();
      socket.emit('auth:identified', { success: true, socketId: socket.id });
    });

    socket.on('presence:request_online_list', () => {
      broadcastOnlineUsers();
    });

    // --- ROULETTE MATCHMAKING ---

    function tryMatchUsers() {
      if (rouletteQueue.length < 2) return;

      // Clean up stale or disconnected sockets
      rouletteQueue = rouletteQueue.filter((q) => {
        const sock = io.sockets.sockets.get(q.socketId);
        return sock && sock.connected;
      });

      while (rouletteQueue.length >= 2) {
        const userA = rouletteQueue.shift()!;
        const userB = rouletteQueue.shift()!;

        // Avoid matching user with their own multi-tabs
        if (userA.userId === userB.userId && rouletteQueue.length > 0) {
          const alternate = rouletteQueue.shift()!;
          rouletteQueue.unshift(userB); // put back userB
          // Pair userA with alternate
          createRouletteRoom(userA, alternate);
          continue;
        }

        createRouletteRoom(userA, userB);
      }
    }

    function createRouletteRoom(peer1: QueueItem, peer2: QueueItem) {
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      activeRooms.set(roomId, new Set([peer1.socketId, peer2.socketId]));

      const data1 = socketData.get(peer1.socketId) || { userId: peer1.userId, username: 'Usuário', unique_code: '' };
      const data2 = socketData.get(peer2.socketId) || { userId: peer2.userId, username: 'Usuário', unique_code: '' };

      const userProfile1 = db.users.find((u) => u.id === peer1.userId);
      const userProfile2 = db.users.find((u) => u.id === peer2.userId);

      const sock1 = io.sockets.sockets.get(peer1.socketId);
      const sock2 = io.sockets.sockets.get(peer2.socketId);

      if (sock1) sock1.join(roomId);
      if (sock2) sock2.join(roomId);

      // Peer 1 is the WebRTC initiator (creates offer)
      io.to(peer1.socketId).emit('roulette:matched', {
        roomId,
        isInitiator: true,
        peerSocketId: peer2.socketId,
        peer: {
          id: data2.userId,
          username: data2.username,
          unique_code: data2.unique_code,
          country: userProfile2?.country || 'Global 🌐',
          avatar: userProfile2?.avatar,
        },
      });

      // Peer 2 waits for offer
      io.to(peer2.socketId).emit('roulette:matched', {
        roomId,
        isInitiator: false,
        peerSocketId: peer1.socketId,
        peer: {
          id: data1.userId,
          username: data1.username,
          unique_code: data1.unique_code,
          country: userProfile1?.country || 'Global 🌐',
          avatar: userProfile1?.avatar,
        },
      });
    }

    socket.on('roulette:join_queue', (payload: { filter?: string }) => {
      const userId = socketUsers.get(socket.id);
      if (!userId) return;

      // Remove any existing entry for this socket
      rouletteQueue = rouletteQueue.filter((q) => q.socketId !== socket.id);

      rouletteQueue.push({
        socketId: socket.id,
        userId,
        filter: payload?.filter,
        joinedAt: Date.now(),
      });

      socket.emit('roulette:queue_status', { inQueue: true, position: rouletteQueue.length });
      tryMatchUsers();
    });

    socket.on('roulette:leave_queue', () => {
      rouletteQueue = rouletteQueue.filter((q) => q.socketId !== socket.id);
      socket.emit('roulette:queue_status', { inQueue: false });
    });

    socket.on('roulette:next', (payload: { roomId?: string; rejoin?: boolean }) => {
      const { roomId, rejoin } = payload || {};
      if (roomId && activeRooms.has(roomId)) {
        const room = activeRooms.get(roomId)!;
        room.forEach((sId) => {
          if (sId !== socket.id) {
            io.to(sId).emit('roulette:peer_left', { reason: 'O parceiro passou para o próximo.' });
          }
        });
        activeRooms.delete(roomId);
      }

      const userId = socketUsers.get(socket.id);
      if (rejoin && userId) {
        rouletteQueue = rouletteQueue.filter((q) => q.socketId !== socket.id);
        rouletteQueue.push({
          socketId: socket.id,
          userId,
          joinedAt: Date.now(),
        });
        socket.emit('roulette:queue_status', { inQueue: true, position: rouletteQueue.length });
        tryMatchUsers();
      }
    });

    // --- DIRECT CALL SIGNALING (TELEPHONE STYLE) ---

    socket.on('call:dial', (data: { targetCode: string; callType: 'video' | 'audio'; callerInfo?: any }) => {
      let callerId = socketUsers.get(socket.id);
      let callerData = socketData.get(socket.id);

      // Auto-identify if caller passed credentials in dial payload
      if (!callerId && data.callerInfo && typeof data.callerInfo.id === 'string') {
        const cId: string = data.callerInfo.id;
        callerId = cId;
        const code = String(data.callerInfo.unique_code || '').toUpperCase();
        socketUsers.set(socket.id, cId);
        socketData.set(socket.id, {
          userId: cId,
          username: String(data.callerInfo.username || 'Usuário'),
          unique_code: code,
        });
        if (!userSockets.has(cId)) userSockets.set(cId, new Set());
        userSockets.get(cId)!.add(socket.id);
        if (code) {
          if (!codeSockets.has(code)) codeSockets.set(code, new Set());
          codeSockets.get(code)!.add(socket.id);
        }
        callerData = socketData.get(socket.id);
      }

      if (!callerId) {
        return socket.emit('call:error', { message: 'Você precisa estar autenticado na plataforma.' });
      }

      const cleanCode = data.targetCode.trim().toUpperCase();
      const targetUser = db.users.find((u) => u.unique_code.toUpperCase() === cleanCode);

      if (!targetUser) {
        return socket.emit('call:error', { message: `Código ${cleanCode} não existe na plataforma.` });
      }

      if (targetUser.id === callerId || (callerData && callerData.unique_code === cleanCode)) {
        return socket.emit('call:error', { message: 'Você não pode ligar para o seu próprio código.' });
      }

      if (targetUser.status === 'banned') {
        return socket.emit('call:error', { message: 'Este usuário está indisponível ou suspenso pela moderação.' });
      }

      const callerUser = db.users.find((u) => u.id === callerId) || {
        id: callerId,
        username: callerData?.username || 'Usuário',
        unique_code: callerData?.unique_code || '',
        avatar: undefined,
        country: undefined,
      };

      const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // Locate recipient sockets by unique_code OR by user.id
      const socketsByCode = codeSockets.get(cleanCode) || new Set<string>();
      const socketsById = userSockets.get(targetUser.id) || new Set<string>();
      const allTargetSockets = new Set<string>([...socketsByCode, ...socketsById]);

      // Filter for currently connected recipient sockets
      const activeRecipientSockets: string[] = [];
      allTargetSockets.forEach((sId) => {
        if (sId !== socket.id) {
          const s = io.sockets.sockets.get(sId);
          if (s && s.connected) {
            activeRecipientSockets.push(sId);
          }
        }
      });

      console.log(`[call:dial] From: ${callerUser.unique_code} To: ${cleanCode}. Active recipient sockets: ${activeRecipientSockets.length}`);

      if (activeRecipientSockets.length > 0) {
        // Real user is online on one or more tabs/devices!
        const receiverSocketId = activeRecipientSockets[0];
        activeCalls.set(callId, {
          callerSocketId: socket.id,
          receiverSocketId,
          callerCode: callerUser.unique_code || '',
          receiverCode: targetUser.unique_code,
          startTime: Date.now(),
        });

        // Notify caller that phone is ringing
        socket.emit('call:ringing', {
          callId,
          isOffline: false,
          targetUser: {
            id: targetUser.id,
            username: targetUser.username,
            unique_code: targetUser.unique_code,
            avatar: targetUser.avatar,
            country: targetUser.country,
          },
        });

        // Send incoming call modal & ringtone to ALL active sockets of the recipient
        activeRecipientSockets.forEach((sId) => {
          io.to(sId).emit('call:incoming', {
            callId,
            callerSocketId: socket.id,
            caller: {
              id: callerId,
              username: callerUser.username,
              unique_code: callerUser.unique_code,
              avatar: callerUser.avatar,
              country: callerUser.country,
            },
            callType: data.callType || 'video',
          });
        });

        // Set a 35-second timeout in case recipient doesn't answer
        const timeoutTimer = setTimeout(() => {
          if (activeCalls.has(callId)) {
            activeCalls.delete(callId);
            socket.emit('call:rejected', {
              callId,
              reason: 'O destinatário não atendeu a chamada a tempo.',
            });
            activeRecipientSockets.forEach((sId) => {
              io.to(sId).emit('call:ended', { reason: 'Chamada perdida.' });
            });
          }
        }, 35000);

        socket.once('call:hangup', () => clearTimeout(timeoutTimer));
        socket.once('disconnect', () => clearTimeout(timeoutTimer));
      } else {
        // Target is not connected on a live socket right now.
        // Send ringing tone to caller and inform them target is currently offline,
        // while offering an automatic demonstration companion after a realistic ring.
        socket.emit('call:ringing', {
          callId,
          isOffline: true,
          targetUser: {
            id: targetUser.id,
            username: targetUser.username,
            unique_code: targetUser.unique_code,
            avatar: targetUser.avatar,
            country: targetUser.country,
          },
        });

        const timer = setTimeout(() => {
          if (io.sockets.sockets.get(socket.id)) {
            const roomId = `direct_room_${callId}`;
            socket.emit('call:accepted', {
              callId,
              roomId,
              peerSocketId: 'virtual_peer',
              isInitiator: false,
              isAutoAttendant: true,
              peer: {
                id: targetUser.id,
                username: targetUser.username,
                unique_code: targetUser.unique_code,
                avatar: targetUser.avatar,
                country: targetUser.country,
              },
            });
          }
        }, 3500);

        socket.once('call:hangup', () => clearTimeout(timer));
        socket.once('disconnect', () => clearTimeout(timer));
      }
    });

    socket.on('call:accept', (data: { callId: string; callerSocketId: string }) => {
      console.log(`[call:accept] Call ${data.callId} accepted by ${socket.id}`);
      const roomId = `direct_room_${data.callId}`;
      activeRooms.set(roomId, new Set([data.callerSocketId, socket.id]));

      const sockCaller = io.sockets.sockets.get(data.callerSocketId);
      if (sockCaller) sockCaller.join(roomId);
      socket.join(roomId);

      const callerUser = socketData.get(data.callerSocketId);
      const receiverUser = socketData.get(socket.id);

      // Caller initiates the WebRTC offer
      io.to(data.callerSocketId).emit('call:accepted', {
        callId: data.callId,
        roomId,
        peerSocketId: socket.id,
        isInitiator: true,
        peer: receiverUser,
      });

      // Receiver will answer the offer
      socket.emit('call:accepted', {
        callId: data.callId,
        roomId,
        peerSocketId: data.callerSocketId,
        isInitiator: false,
        peer: callerUser,
      });
    });

    socket.on('call:reject', (data: { callId: string; callerSocketId: string; reason?: string }) => {
      console.log(`[call:reject] Call ${data.callId} rejected by ${socket.id}`);
      activeCalls.delete(data.callId);
      if (data.callerSocketId) {
        io.to(data.callerSocketId).emit('call:rejected', {
          callId: data.callId,
          reason: data.reason || 'Chamada recusada pelo destinatário.',
        });
      }
    });

    socket.on('call:hangup', (data: { callId?: string; roomId?: string; targetSocketId?: string }) => {
      if (data.callId) activeCalls.delete(data.callId);
      if (data.roomId) {
        const room = activeRooms.get(data.roomId);
        if (room) {
          room.forEach((sId) => {
            if (sId !== socket.id) {
              io.to(sId).emit('call:ended', { reason: 'Chamada encerrada pelo usuário.' });
            }
          });
          activeRooms.delete(data.roomId);
        }
      } else if (data.targetSocketId) {
        io.to(data.targetSocketId).emit('call:ended', { reason: 'Chamada encerrada pelo usuário.' });
      }
    });

    // --- WEBRTC SIGNALING RELAY (P2P) ---

    socket.on('webrtc:offer', (payload: { toSocketId: string; sdp: any; roomId?: string }) => {
      io.to(payload.toSocketId).emit('webrtc:offer', {
        fromSocketId: socket.id,
        sdp: payload.sdp,
        roomId: payload.roomId,
      });
    });

    socket.on('webrtc:answer', (payload: { toSocketId: string; sdp: any; roomId?: string }) => {
      io.to(payload.toSocketId).emit('webrtc:answer', {
        fromSocketId: socket.id,
        sdp: payload.sdp,
        roomId: payload.roomId,
      });
    });

    socket.on('webrtc:ice_candidate', (payload: { toSocketId: string; candidate: any; roomId?: string }) => {
      io.to(payload.toSocketId).emit('webrtc:ice_candidate', {
        fromSocketId: socket.id,
        candidate: payload.candidate,
        roomId: payload.roomId,
      });
    });

    // --- IN-CALL CHAT & REACTIONS ---

    socket.on('chat:message', (payload: { toSocketId?: string; roomId?: string; text: string; senderName: string }) => {
      const msg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sender_id: socket.id,
        sender_name: payload.senderName || 'Usuário',
        text: payload.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      if (payload.roomId && activeRooms.has(payload.roomId)) {
        io.to(payload.roomId).emit('chat:message', msg);
      } else if (payload.toSocketId) {
        io.to(payload.toSocketId).emit('chat:message', msg);
        socket.emit('chat:message', msg);
      }
    });

    socket.on('call:reaction', (payload: { toSocketId?: string; roomId?: string; emoji: string }) => {
      if (payload.roomId) {
        socket.to(payload.roomId).emit('call:reaction', { emoji: payload.emoji });
      } else if (payload.toSocketId) {
        io.to(payload.toSocketId).emit('call:reaction', { emoji: payload.emoji });
      }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      console.log(`[Socket Disconnected] ID: ${socket.id}`);
      const userId = socketUsers.get(socket.id);

      // Remove from roulette queue
      rouletteQueue = rouletteQueue.filter((q) => q.socketId !== socket.id);

      // Inform active rooms
      for (const [roomId, members] of activeRooms.entries()) {
        if (members.has(socket.id)) {
          members.forEach((sId) => {
            if (sId !== socket.id) {
              io.to(sId).emit('roulette:peer_left', { reason: 'O parceiro se desconectou.' });
              io.to(sId).emit('call:ended', { reason: 'O parceiro se desconectou.' });
            }
          });
          activeRooms.delete(roomId);
        }
      }

      // Clean active direct calls
      for (const [callId, call] of activeCalls.entries()) {
        if (call.callerSocketId === socket.id) {
          io.to(call.receiverSocketId).emit('call:ended', { reason: 'O autor da chamada desconectou.' });
          activeCalls.delete(callId);
        } else if (call.receiverSocketId === socket.id) {
          io.to(call.callerSocketId).emit('call:ended', { reason: 'O destinatário desconectou.' });
          activeCalls.delete(callId);
        }
      }

      // Cleanup user socket map
      if (userId && userSockets.has(userId)) {
        const set = userSockets.get(userId)!;
        set.delete(socket.id);
        if (set.size === 0) {
          userSockets.delete(userId);
          broadcastUserPresence(userId, 'offline');
        }
      }

      // Cleanup code socket map
      const uData = socketData.get(socket.id);
      if (uData && uData.unique_code && codeSockets.has(uData.unique_code)) {
        const cSet = codeSockets.get(uData.unique_code)!;
        cSet.delete(socket.id);
        if (cSet.size === 0) {
          codeSockets.delete(uData.unique_code);
        }
      }

      socketUsers.delete(socket.id);
      socketData.delete(socket.id);
      broadcastOnlineUsers();
    });
  });

  // --- VITE MIDDLEWARE INTEGRATION ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
