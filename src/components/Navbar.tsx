import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Video,
  Phone,
  Shield,
  Copy,
  Check,
  User as UserIcon,
  LogIn,
  LogOut,
  ChevronDown,
  Sparkles,
  Radio,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'roulette' | 'direct' | 'admin';
  onSelectTab: (tab: 'roulette' | 'direct' | 'admin') => void;
  onOpenAuth: () => void;
  pendingReportsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuth,
  pendingReportsCount = 0,
}) => {
  const { user, logout, serverMode } = useAuth();
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const copyCode = () => {
    if (user?.unique_code) {
      navigator.clipboard.writeText(user.unique_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-600/30">
            <Radio className="w-5 h-5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-white tracking-tight">
                ChatRoulette<span className="text-indigo-400">P2P</span>
              </span>
              <span
                className={`hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                  serverMode === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                }`}
                title={serverMode === 'connected' ? 'Conectado ao servidor Socket.io em tempo real' : 'Executando em modo resiliente local / Vercel'}
              >
                {serverMode === 'connected' ? '● Servidor Online' : '⚡ Modo Resiliente P2P'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Vídeo aleatório & chamadas diretas por código
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => onSelectTab('roulette')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentTab === 'roulette'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Roleta Global</span>
          </button>

          <button
            onClick={() => onSelectTab('direct')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentTab === 'direct'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>Chamada Direta</span>
          </button>

          <button
            onClick={() => onSelectTab('admin')}
            className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentTab === 'admin'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Painel Admin</span>
            {pendingReportsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        </nav>

        {/* User Status / Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {/* Unique Code Badge with 1-Click Copy */}
              <button
                onClick={copyCode}
                className="group relative flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 hover:border-indigo-500/60 rounded-xl transition cursor-pointer"
                title="Clique para copiar seu código único de chamada"
              >
                <div className="text-left">
                  <div className="text-[10px] uppercase font-bold text-zinc-400 group-hover:text-indigo-300 transition">
                    Seu Código de Chamada
                  </div>
                  <div className="font-mono text-xs font-bold text-emerald-400 tracking-wider">
                    {user.unique_code}
                  </div>
                </div>
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white" />
                )}

                {copied && (
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900 border border-emerald-500/40 text-emerald-300 text-[10px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
                    Copiado para o clipboard!
                  </div>
                )}
              </button>

              {/* User Avatar & Menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 p-1.5 pr-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition"
                >
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                    alt={user.username}
                    className="w-7 h-7 rounded-lg object-cover border border-zinc-700"
                  />
                  <div className="text-left hidden md:block">
                    <span className="block text-xs font-semibold text-white truncate max-w-[100px]">
                      {user.username}
                    </span>
                    <span className="block text-[10px] text-zinc-400">
                      {user.role === 'admin' ? '🛡️ Admin' : '👤 Usuário'}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl py-2 z-50 text-xs"
                    onClick={() => setMenuOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-zinc-800">
                      <p className="font-semibold text-white">{user.username}</p>
                      <p className="text-zinc-400 text-[11px] truncate">{user.email}</p>
                      <p className="font-mono text-emerald-400 text-[11px] mt-1 font-bold">
                        {user.unique_code}
                      </p>
                    </div>

                    <button
                      onClick={onOpenAuth}
                      className="w-full text-left px-4 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Trocar de Conta / Demo
                    </button>

                    {user.role === 'admin' && (
                      <button
                        onClick={() => onSelectTab('admin')}
                        className="w-full text-left px-4 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2"
                      >
                        <Shield className="w-3.5 h-3.5 text-indigo-400" />
                        Painel Administrativo
                      </button>
                    )}

                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 border-t border-zinc-800 mt-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sair da Conta
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
            >
              <LogIn className="w-4 h-4" />
              <span>Entrar / Cadastrar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
