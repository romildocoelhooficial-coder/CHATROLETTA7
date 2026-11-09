export type UserRole = 'user' | 'admin';

export type UserStatus = 'online' | 'busy' | 'offline' | 'banned';

export interface User {
  id: string;
  unique_code: string; // e.g. #CR-849201
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  country?: string;
  gender?: string;
  bio?: string;
  avatar?: string;
  ban_reason?: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reported_id: string;
  reported_name: string;
  reported_code: string;
  reason: string;
  details?: string;
  created_at: string;
  resolved: boolean;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_code?: string;
  text: string;
  timestamp: string;
  is_system?: boolean;
}

export interface CallSession {
  callId: string;
  caller: {
    id: string;
    username: string;
    unique_code: string;
    avatar?: string;
  };
  receiver: {
    id: string;
    username: string;
    unique_code: string;
    avatar?: string;
  };
  type: 'roulette' | 'direct';
  startTime: number;
}
