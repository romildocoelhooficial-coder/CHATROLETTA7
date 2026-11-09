// Vercel Serverless Function entry point for full-stack API compatibility
import type { Request, Response } from 'express';

interface User {
  id: string;
  unique_code: string;
  username: string;
  email: string;
  password_hash?: string;
  role: 'user' | 'admin';
  status: 'online' | 'busy' | 'offline' | 'banned';
  country?: string;
  avatar?: string;
  created_at: string;
}

const mockUsers: User[] = [
  {
    id: 'user_admin_001',
    unique_code: '#CR-000001',
    username: 'Administrador Master',
    email: 'admin@chatroulette.com',
    password_hash: 'admin123',
    role: 'admin',
    status: 'online',
    country: 'Brasil 🇧🇷',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'user_002',
    unique_code: '#CR-849201',
    username: 'Lucas Silva',
    email: 'lucas@exemplo.com',
    password_hash: 'user123',
    role: 'user',
    status: 'online',
    country: 'Brasil 🇧🇷',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'user_003',
    unique_code: '#CR-193852',
    username: 'Sofia Martinez',
    email: 'sofia@exemplo.com',
    password_hash: 'user123',
    role: 'user',
    status: 'online',
    country: 'Portugal 🇵🇹',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'user_004',
    unique_code: '#CR-648291',
    username: 'Alex Morgan',
    email: 'alex@exemplo.com',
    password_hash: 'user123',
    role: 'user',
    status: 'offline',
    country: 'Estados Unidos 🇺🇸',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'user_005',
    unique_code: '#CR-552910',
    username: 'Clara Costa',
    email: 'clara@exemplo.com',
    password_hash: 'user123',
    role: 'user',
    status: 'online',
    country: 'Espanha 🇪🇸',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

export default function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';

  // Auth: /api/auth/login
  if (url.includes('/api/auth/login')) {
    const { identifier, password } = req.body || {};
    const cleanId = (identifier || '').trim().toLowerCase();
    const user = mockUsers.find(
      (u) =>
        u.email.toLowerCase() === cleanId ||
        u.username.toLowerCase() === cleanId ||
        u.unique_code.toLowerCase() === cleanId
    );

    if (!user || user.password_hash !== password) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const { password_hash, ...safe } = user;
    return res.status(200).json({ user: safe, token: safe.id });
  }

  // Auth: /api/auth/me
  if (url.includes('/api/auth/me')) {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    const user = mockUsers.find((u) => u.id === token) || mockUsers[1];
    const { password_hash, ...safe } = user;
    return res.status(200).json({ user: safe });
  }

  // Users by code: /api/users/by-code/:code
  if (url.includes('/api/users/by-code/')) {
    const parts = url.split('/by-code/');
    const rawCode = decodeURIComponent(parts[1] || '').trim().toUpperCase();
    const clean = rawCode.startsWith('#') ? rawCode : `#${rawCode}`;
    const user = mockUsers.find((u) => u.unique_code.toUpperCase() === clean);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    const { password_hash, ...safe } = user;
    return res.status(200).json({ user: safe });
  }

  // Fallback for socket.io polling on Vercel: return clean 200 so it doesn't log 404
  if (url.includes('/socket.io/')) {
    return res.status(200).json({ message: 'Socket.io running on WebRTC P2P direct mode' });
  }

  return res.status(200).json({ status: 'ok', name: 'ChatRoulette P2P Serverless API' });
}
