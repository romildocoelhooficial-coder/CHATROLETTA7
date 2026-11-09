import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { X, UserPlus, LogIn, Shield, Users, Check, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { login, register, switchUser } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('Brasil 🇧🇷');
  const [gender, setGender] = useState('unspecified');
  const [bio, setBio] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await login(identifier, password);
    setLoading(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Credenciais inválidas.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await register({
      username,
      email,
      password,
      country,
      gender,
      bio,
    });
    setLoading(false);
    if (res.success) {
      setSuccessMsg('Cadastro realizado! Seu código único foi gerado.');
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setError(res.error || 'Erro ao registrar.');
    }
  };

  const demoAccounts = [
    {
      name: 'Admin Master',
      code: '#CR-000001',
      email: 'admin@chatroulette.com',
      role: 'admin',
      desc: 'Acesso total ao Painel Administrativo e Moderação',
      flag: '🇧🇷',
    },
    {
      name: 'Lucas Silva',
      code: '#CR-849201',
      email: 'lucas@exemplo.com',
      role: 'user',
      desc: 'Usuário padrão do Brasil',
      flag: '🇧🇷',
    },
    {
      name: 'Sofia Martinez',
      code: '#CR-193852',
      email: 'sofia@exemplo.com',
      role: 'user',
      desc: 'Usuária de Portugal',
      flag: '🇵🇹',
    },
    {
      name: 'Alex Morgan',
      code: '#CR-648291',
      email: 'alex@exemplo.com',
      role: 'user',
      desc: 'Usuário dos EUA',
      flag: '🇺🇸',
    },
  ];

  const handleQuickLogin = async (account: typeof demoAccounts[0]) => {
    setError(null);
    setLoading(true);
    const pass = account.role === 'admin' ? 'admin123' : 'user123';
    const res = await login(account.email, pass);
    setLoading(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Erro ao alternar de conta.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Tabs */}
        <div className="flex border-b border-zinc-800 mb-6 pb-2">
          <button
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex items-center gap-2 pb-2 px-3 font-semibold text-sm transition border-b-2 ${
              mode === 'login'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LogIn className="w-4 h-4" /> Entrar
          </button>
          <button
            onClick={() => { setMode('register'); setError(null); }}
            className={`flex items-center gap-2 pb-2 px-3 font-semibold text-sm transition border-b-2 ${
              mode === 'register'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UserPlus className="w-4 h-4" /> Cadastrar-se
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-500/50 rounded-xl text-red-200 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-500/50 rounded-xl text-emerald-200 text-sm flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {mode === 'login' ? (
          <div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  E-mail ou Código de Usuário (#CR-XXXXXX)
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ex: lucas@exemplo.com ou #CR-849201"
                  required
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha secreta"
                  required
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Entrando...' : 'Acessar Plataforma'}
              </button>
            </form>

            {/* Quick Demo Switcher */}
            <div className="mt-6 pt-5 border-t border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" /> Contas Pré-configuradas para Teste Rápido:
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    onClick={() => handleQuickLogin(acc)}
                    className="p-2.5 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 hover:border-indigo-500/50 rounded-xl text-left transition flex flex-col group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-white group-hover:text-indigo-300 flex items-center gap-1">
                        {acc.flag} {acc.name}
                      </span>
                      {acc.role === 'admin' && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-1 rounded border border-amber-500/30">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-indigo-400 mt-0.5">{acc.code}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Nome de Usuário
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Como quer ser chamado?"
                required
                className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                required
                className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  País de Origem
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="Brasil 🇧🇷">Brasil 🇧🇷</option>
                  <option value="Portugal 🇵🇹">Portugal 🇵🇹</option>
                  <option value="Estados Unidos 🇺🇸">Estados Unidos 🇺🇸</option>
                  <option value="Espanha 🇪🇸">Espanha 🇪🇸</option>
                  <option value="Alemanha 🇩🇪">Alemanha 🇩🇪</option>
                  <option value="Global 🌐">Outro / Global 🌐</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Identificação
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="unspecified">Não especificar</option>
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Breve Apresentação (Bio opcional)
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="ex: Curto música, jogos e idiomas"
                className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-xs text-indigo-300">
              ℹ️ Ao se cadastrar, nosso sistema gerará automaticamente um <strong>Código Único exclusivo (#CR-XXXXXX)</strong> para você receber chamadas diretas como um telefone!
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Cadastrando...' : 'Criar Conta e Obter Código'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
