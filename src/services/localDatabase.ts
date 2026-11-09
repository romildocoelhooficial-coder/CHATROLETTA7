import { User, Report } from '../types/index.ts';

const LOCAL_USERS_KEY = 'cr_local_users';
const LOCAL_REPORTS_KEY = 'cr_local_reports';

export const initialLocalUsers: (User & { password_hash: string })[] = [
  {
    id: 'user_admin_001',
    unique_code: '#CR-000001',
    username: 'Administrador Master',
    email: 'admin@chatroulette.com',
    password_hash: 'admin123',
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
    password_hash: 'user123',
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
    password_hash: 'user123',
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
    password_hash: 'user123',
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
    password_hash: 'user123',
    role: 'user',
    status: 'online',
    country: 'Espanha 🇪🇸',
    gender: 'female',
    bio: '¡Hola! Vamos a practicar idiomas y charlar.',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

export const initialLocalReports: Report[] = [
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

export class LocalDatabaseService {
  public getUsers(): (User & { password_hash: string })[] {
    try {
      const stored = localStorage.getItem(LOCAL_USERS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse local users', e);
    }
    this.saveUsers(initialLocalUsers);
    return initialLocalUsers;
  }

  public saveUsers(users: (User & { password_hash: string })[]) {
    try {
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.warn('Failed to save local users', e);
    }
  }

  public getReports(): Report[] {
    try {
      const stored = localStorage.getItem(LOCAL_REPORTS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse local reports', e);
    }
    this.saveReports(initialLocalReports);
    return initialLocalReports;
  }

  public saveReports(reports: Report[]) {
    try {
      localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports));
    } catch (e) {
      console.warn('Failed to save local reports', e);
    }
  }

  public generateUniqueCode(): string {
    const users = this.getUsers();
    let code = '';
    let exists = true;
    while (exists) {
      const num = Math.floor(100000 + Math.random() * 900000);
      code = `#CR-${num}`;
      exists = users.some((u) => u.unique_code === code);
    }
    return code;
  }

  public login(identifier: string, password: string): { user: User; token: string } | null {
    const users = this.getUsers();
    const clean = identifier.trim().toLowerCase();
    const found = users.find(
      (u) =>
        u.email.toLowerCase() === clean ||
        u.unique_code.toLowerCase() === clean
    );

    if (!found || found.password_hash !== password) {
      return null;
    }

    if (found.status === 'banned') {
      throw new Error(`Sua conta foi suspensa pela moderação. Motivo: ${found.ban_reason || 'Violação dos termos'}`);
    }

    found.status = 'online';
    this.saveUsers(users);

    const { password_hash, ...safeUser } = found;
    return { user: safeUser, token: safeUser.id };
  }

  public register(data: {
    username: string;
    email: string;
    password: string;
    country?: string;
    gender?: string;
    bio?: string;
  }): { user: User; token: string } {
    const users = this.getUsers();
    const cleanEmail = data.email.trim().toLowerCase();

    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('Já existe um usuário cadastrado com este e-mail.');
    }

    const uniqueCode = this.generateUniqueCode();
    const newUser: User & { password_hash: string } = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      unique_code: uniqueCode,
      username: data.username.trim(),
      email: cleanEmail,
      password_hash: data.password,
      role: 'user',
      status: 'online',
      country: data.country || 'Brasil 🇧🇷',
      gender: data.gender || 'unspecified',
      bio: data.bio || '',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.username)}`,
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    this.saveUsers(users);

    const { password_hash, ...safeUser } = newUser;
    return { user: safeUser, token: safeUser.id };
  }

  public getUserByCode(code: string): User | null {
    const users = this.getUsers();
    const clean = code.trim().toUpperCase();
    const formatted = clean.startsWith('#') ? clean : `#${clean}`;
    const user = users.find((u) => u.unique_code.toUpperCase() === formatted);
    if (!user) return null;
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
}

export const localDb = new LocalDatabaseService();
