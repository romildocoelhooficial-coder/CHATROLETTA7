import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { User, Report } from '../types/index.ts';
import { localDb } from '../services/localDatabase.ts';
import {
  Shield,
  Users,
  UserPlus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Ban,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  PhoneCall,
  Lock,
  Eye,
  X,
  Radio,
  Flag,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user, token, switchUser } = useAuth();

  // Metrics
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    activeCalls: 0,
    bannedUsers: 0,
    pendingReports: 0,
  });

  // Active Tab: 'users' | 'reports'
  const [adminTab, setAdminTab] = useState<'users' | 'reports'>('users');

  // Users list state
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Reports state
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Modals state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [banReasonInput, setBanReasonInput] = useState('');

  // Edit / Create Form states
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user' as 'user' | 'admin',
    status: 'online' as 'online' | 'busy' | 'offline' | 'banned',
    country: 'Brasil 🇧🇷',
    bio: '',
  });

  // Notification message
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showAlert = (message: string, type: 'success' | 'error' = 'success') => {
    setActionAlert({ type, message });
    setTimeout(() => setActionAlert(null), 3500);
  };

  // Fetch metrics
  const fetchMetrics = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setMetrics(data);
        return;
      }
    } catch (e) {
      // ignore
    }
    // Local fallback
    const allUsers = localDb.getUsers();
    const allReports = localDb.getReports();
    setMetrics({
      totalUsers: allUsers.length,
      onlineUsers: allUsers.filter((u) => u.status === 'online').length,
      activeCalls: 0,
      bannedUsers: allUsers.filter((u) => u.status === 'banned').length,
      pendingReports: allReports.filter((r) => !r.resolved).length,
    });
  };

  // Fetch Users
  const fetchUsers = async () => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const query = new URLSearchParams({
        search,
        status: statusFilter,
        role: roleFilter,
        page: page.toString(),
        limit: '8',
      });
      const res = await fetch(`/api/admin/users?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setUsers(data.users);
        setTotalPages(data.pagination.totalPages);
        setLoadingUsers(false);
        return;
      }
    } catch (e) {
      // ignore
    }
    // Local fallback
    let filtered = localDb.getUsers().map((u) => {
      const { password_hash, ...safe } = u;
      return safe;
    });
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.username.toLowerCase().includes(s) ||
          u.email.toLowerCase().includes(s) ||
          u.unique_code.toLowerCase().includes(s)
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((u) => u.status === statusFilter);
    }
    if (roleFilter !== 'all') {
      filtered = filtered.filter((u) => u.role === roleFilter);
    }
    const limit = 8;
    setTotalPages(Math.ceil(filtered.length / limit) || 1);
    setUsers(filtered.slice((page - 1) * limit, page * limit));
    setLoadingUsers(false);
  };

  // Fetch Reports
  const fetchReports = async () => {
    if (!token) return;
    setLoadingReports(true);
    try {
      const res = await fetch('/api/admin/reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setReports(data.reports);
        setLoadingReports(false);
        return;
      }
    } catch (e) {
      // ignore
    }
    setReports(localDb.getReports());
    setLoadingReports(false);
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchMetrics();
      fetchUsers();
      fetchReports();
    }
  }, [user, search, statusFilter, roleFilter, page]);

  // Handle Ban / Unban
  const handleToggleBan = async (userToBan: User, reason: string = 'Violação dos Termos') => {
    if (!token) return;
    const isBanning = userToBan.status !== 'banned';
    try {
      const res = await fetch(`/api/admin/users/${userToBan.id}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: isBanning ? 'ban' : 'unban',
          reason,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        showAlert(data.message, 'success');
        setIsBanModalOpen(false);
        fetchUsers();
        fetchMetrics();
        return;
      }
    } catch (e) {
      // Local fallback
    }

    // Update in localDb
    const allUsers = localDb.getUsers();
    const u = allUsers.find((x) => x.id === userToBan.id);
    if (u) {
      u.status = isBanning ? 'banned' : 'offline';
      u.ban_reason = isBanning ? reason : undefined;
      localDb.saveUsers(allUsers);
      showAlert(isBanning ? 'Usuário banido com sucesso.' : 'Usuário desbanido.', 'success');
      setIsBanModalOpen(false);
      fetchUsers();
      fetchMetrics();
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (id: string, username: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o usuário "${username}" permanentemente?`)) {
      return;
    }
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        showAlert(data.message, 'success');
        fetchUsers();
        fetchMetrics();
        return;
      }
    } catch (e) {
      // Local fallback
    }

    let allUsers = localDb.getUsers();
    allUsers = allUsers.filter((u) => u.id !== id);
    localDb.saveUsers(allUsers);
    showAlert(`Usuário ${username} removido com sucesso.`, 'success');
    fetchUsers();
    fetchMetrics();
  };

  // Handle Edit User
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !token) return;

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        showAlert('Usuário atualizado com sucesso!', 'success');
        setIsEditModalOpen(false);
        fetchUsers();
        return;
      }
    } catch (e) {
      // Local fallback
    }

    const allUsers = localDb.getUsers();
    const u = allUsers.find((x) => x.id === selectedUser.id);
    if (u) {
      if (formData.username) u.username = formData.username;
      if (formData.email) u.email = formData.email;
      if (formData.role) u.role = formData.role;
      if (formData.status) u.status = formData.status;
      if (formData.country) u.country = formData.country;
      if (formData.bio !== undefined) u.bio = formData.bio;
      localDb.saveUsers(allUsers);
      showAlert('Usuário atualizado com sucesso!', 'success');
      setIsEditModalOpen(false);
      fetchUsers();
    }
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        showAlert('Novo usuário cadastrado!', 'success');
        setIsCreateModalOpen(false);
        fetchUsers();
        fetchMetrics();
        return;
      }
    } catch (e) {
      // Local fallback
    }

    try {
      localDb.register({
        username: formData.username,
        email: formData.email,
        password: formData.password || 'user123',
        country: formData.country,
        bio: formData.bio,
      });
      showAlert('Novo usuário cadastrado com sucesso!', 'success');
      setIsCreateModalOpen(false);
      fetchUsers();
      fetchMetrics();
    } catch (err: any) {
      showAlert(err?.message || 'Erro ao criar usuário', 'error');
    }
  };

  // Resolve Report
  const handleResolveReport = async (reportId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showAlert('Denúncia marcada como resolvida!', 'success');
        fetchReports();
        fetchMetrics();
        return;
      }
    } catch (e) {
      // Local fallback
    }

    const allReports = localDb.getReports();
    const rep = allReports.find((r) => r.id === reportId);
    if (rep) {
      rep.resolved = true;
      localDb.saveReports(allReports);
      showAlert('Denúncia marcada como resolvida!', 'success');
      fetchReports();
      fetchMetrics();
    }
  };

  // Fast switch to admin for convenience
  const handleElevateToAdmin = () => {
    const adminUser: User = {
      id: 'user_admin_001',
      unique_code: '#CR-000001',
      username: 'Administrador Master',
      email: 'admin@chatroulette.com',
      role: 'admin',
      status: 'online',
      country: 'Brasil 🇧🇷',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      created_at: new Date().toISOString(),
    };
    switchUser(adminUser);
  };

  // Not Admin Gate
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950 text-center">
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito ao Painel Admin</h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
          Você está conectado como <strong className="text-zinc-200">{user?.username || 'Visitante'}</strong>.
          Para gerenciar o sistema, visualizar usuários, editar registros e aplicar punições, alterne para o perfil de administrador.
        </p>
        <button
          onClick={handleElevateToAdmin}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-indigo-600/30"
        >
          <Shield className="w-4 h-4" />
          <span>Acessar como Administrador Master (#CR-000001)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-950 p-4 md:p-8 space-y-6">
      {/* Action Notification */}
      {actionAlert && (
        <div
          className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-2 border ${
            actionAlert.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/60 border-red-500/40 text-red-200'
          }`}
        >
          {actionAlert.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{actionAlert.message}</span>
        </div>
      )}

      {/* Header and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Painel Administrativo</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Gestão completa de usuários (CRUD), monitoramento em tempo real e moderação de chamadas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchMetrics();
              fetchUsers();
              fetchReports();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar Dados</span>
          </button>

          <button
            onClick={() => {
              setFormData({
                username: '',
                email: '',
                password: 'user123',
                role: 'user',
                status: 'online',
                country: 'Brasil 🇧🇷',
                bio: '',
              });
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/25"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Usuário</span>
          </button>
        </div>
      </div>

      {/* Real-time Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Usuários</span>
          <div className="text-2xl font-black text-white mt-1">{metrics.totalUsers}</div>
          <span className="text-[11px] text-zinc-500">Cadastrados no banco</span>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online Agora
          </span>
          <div className="text-2xl font-black text-emerald-400 mt-1">{metrics.onlineUsers}</div>
          <span className="text-[11px] text-zinc-500">Com socket ativo</span>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Chamadas Ativas</span>
          <div className="text-2xl font-black text-indigo-400 mt-1">{metrics.activeCalls}</div>
          <span className="text-[11px] text-zinc-500">Roleta + Diretas</span>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Usuários Banidos</span>
          <div className="text-2xl font-black text-red-400 mt-1">{metrics.bannedUsers}</div>
          <span className="text-[11px] text-zinc-500">Bloqueados de acessar</span>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Denúncias</span>
          <div className="text-2xl font-black text-amber-400 mt-1">{metrics.pendingReports}</div>
          <span className="text-[11px] text-zinc-500">Aguardando revisão</span>
        </div>
      </div>

      {/* Admin Tab Switcher */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setAdminTab('users')}
          className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm transition border-b-2 ${
            adminTab === 'users'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Gestão de Usuários (CRUD)</span>
        </button>

        <button
          onClick={() => setAdminTab('reports')}
          className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm transition border-b-2 ${
            adminTab === 'reports'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Flag className="w-4 h-4" />
          <span>Denúncias & Moderação</span>
          {metrics.pendingReports > 0 && (
            <span className="px-1.5 py-0.2 bg-red-500/20 text-red-400 border border-red-500/40 rounded-full text-[10px]">
              {metrics.pendingReports}
            </span>
          )}
        </button>
      </div>

      {adminTab === 'users' ? (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, email ou #CR-código..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Todos Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="banned">Banidos</option>
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Todos Papéis</option>
                <option value="user">Usuários</option>
                <option value="admin">Administradores</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/60 text-zinc-400 uppercase font-bold border-b border-zinc-800">
                  <tr>
                    <th className="py-3.5 px-4">Usuário</th>
                    <th className="py-3.5 px-4">Código Único</th>
                    <th className="py-3.5 px-4">Papel</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">País</th>
                    <th className="py-3.5 px-4">Cadastrado em</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-zinc-500">
                        Carregando usuários...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-zinc-500">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-zinc-800/40 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                              alt={u.username}
                              className="w-8 h-8 rounded-lg object-cover border border-zinc-700"
                            />
                            <div>
                              <div className="font-semibold text-white">{u.username}</div>
                              <div className="text-[11px] text-zinc-400">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {u.unique_code}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold text-[10px] uppercase ${
                              u.role === 'admin'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              u.status === 'banned'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : u.status === 'online'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                u.status === 'banned'
                                  ? 'bg-red-400'
                                  : u.status === 'online'
                                  ? 'bg-emerald-400'
                                  : 'bg-zinc-500'
                              }`}
                            />
                            {u.status === 'banned'
                              ? 'Banido'
                              : u.status === 'online'
                              ? 'Online'
                              : 'Offline'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-zinc-300">{u.country || 'Global'}</td>

                        <td className="py-3 px-4 text-zinc-400 text-[11px]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Details */}
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setIsViewModalOpen(true);
                              }}
                              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
                              title="Visualizar Detalhes"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setFormData({
                                  username: u.username,
                                  email: u.email,
                                  password: '',
                                  role: u.role,
                                  status: u.status,
                                  country: u.country || 'Brasil 🇧🇷',
                                  bio: u.bio || '',
                                });
                                setIsEditModalOpen(true);
                              }}
                              className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-lg transition"
                              title="Editar Usuário"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Ban / Unban */}
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setBanReasonInput(u.ban_reason || 'Violação das regras de conduta');
                                setIsBanModalOpen(true);
                              }}
                              className={`p-1.5 rounded-lg transition ${
                                u.status === 'banned'
                                  ? 'text-emerald-400 hover:bg-emerald-500/10'
                                  : 'text-amber-400 hover:bg-amber-500/10'
                              }`}
                              title={u.status === 'banned' ? 'Desbanir Usuário' : 'Banir Usuário'}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                              title="Excluir Usuário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-3.5 bg-zinc-950/40 border-t border-zinc-800 text-xs text-zinc-400">
              <span>
                Página {page} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white rounded-lg transition"
                >
                  Anterior
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white rounded-lg transition"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Reports & Moderation Tab */
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl p-4 md:p-6">
          <h3 className="text-base font-bold text-white mb-2">Relatórios de Denúncias dos Usuários</h3>
          <p className="text-xs text-zinc-400 mb-6">
            Denúncias enviadas em tempo real durante a Roleta ou Chamadas Diretas.
          </p>

          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs">
                Nenhuma denúncia registrada no momento.
              </div>
            ) : (
              reports.map((rep) => (
                <div
                  key={rep.id}
                  className={`p-4 rounded-2xl border transition ${
                    rep.resolved
                      ? 'bg-zinc-950/40 border-zinc-800 opacity-60'
                      : 'bg-zinc-950 border-red-500/30'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          Denunciado: {rep.reported_name}
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          {rep.reported_code}
                        </span>
                        {rep.resolved && (
                          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                            Resolvido
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-red-300 font-semibold mt-1">
                        Motivo: {rep.reason}
                      </p>
                      {rep.details && (
                        <p className="text-xs text-zinc-400 mt-0.5 italic">"{rep.details}"</p>
                      )}

                      <div className="text-[11px] text-zinc-500 mt-2">
                        Denunciante: {rep.reporter_name} • Data: {new Date(rep.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!rep.resolved && (
                        <>
                          <button
                            onClick={() => {
                              const reportedUser = users.find((u) => u.id === rep.reported_id);
                              if (reportedUser) {
                                handleToggleBan(reportedUser, `Denúncia: ${rep.reason}`);
                              } else {
                                showAlert('Usuário já não está no sistema ou banido', 'error');
                              }
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Banir Infrator</span>
                          </button>

                          <button
                            onClick={() => handleResolveReport(rep.id)}
                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition"
                          >
                            Resolver
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- MODALS --- */}

      {/* View User Modal */}
      {isViewModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-4">
              <img
                src={selectedUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedUser.username}`}
                alt={selectedUser.username}
                className="w-20 h-20 rounded-2xl mx-auto object-cover border-2 border-indigo-500 mb-2"
              />
              <h3 className="text-lg font-bold text-white">{selectedUser.username}</h3>
              <p className="font-mono text-emerald-400 font-bold">{selectedUser.unique_code}</p>
            </div>

            <div className="space-y-2.5 text-xs bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <div className="flex justify-between">
                <span className="text-zinc-500">ID do Sistema:</span>
                <span className="font-mono text-zinc-300">{selectedUser.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">E-mail:</span>
                <span className="text-zinc-300">{selectedUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Papel:</span>
                <span className="font-semibold text-white uppercase">{selectedUser.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Status:</span>
                <span className="font-semibold text-white">{selectedUser.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">País:</span>
                <span className="text-zinc-300">{selectedUser.country || 'Global'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Criado em:</span>
                <span className="text-zinc-300">{new Date(selectedUser.created_at).toLocaleString()}</span>
              </div>
              {selectedUser.ban_reason && (
                <div className="p-2 bg-red-950/40 border border-red-500/30 rounded text-red-300 mt-2">
                  Motivo do Ban: {selectedUser.ban_reason}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-4">Editar Usuário</h3>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Nome de Usuário</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">E-mail</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Papel</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="user">Usuário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="banned">Banido</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">País</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-4">Criar Novo Usuário</h3>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Nome de Usuário</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Nome do usuário"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">E-mail</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Senha Inicial</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Papel</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="user">Usuário</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">País</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
                >
                  Cadastrar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ban / Unban Modal */}
      {isBanModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <button
              onClick={() => setIsBanModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-500/10 text-red-400 rounded-xl">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  {selectedUser.status === 'banned' ? 'Desbanir Usuário' : 'Banir Usuário'}
                </h3>
                <p className="text-xs text-zinc-400">
                  {selectedUser.username} ({selectedUser.unique_code})
                </p>
              </div>
            </div>

            {selectedUser.status !== 'banned' ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">
                    Motivo do Banimento em Tempo Real
                  </label>
                  <textarea
                    value={banReasonInput}
                    onChange={(e) => setBanReasonInput(e.target.value)}
                    rows={3}
                    placeholder="ex: Violação das diretrizes de conduta..."
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>
                <p className="text-[11px] text-zinc-400">
                  ⚠️ Ao banir, a conexão de vídeo e a sessão deste usuário serão canceladas imediatamente.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsBanModalOpen(false)}
                    className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleToggleBan(selectedUser, banReasonInput)}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl"
                  >
                    Confirmar Ban
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-zinc-300">
                  Deseja restabelecer o acesso deste usuário à plataforma? Ele poderá voltar a fazer chamadas e entrar na roleta.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsBanModalOpen(false)}
                    className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleToggleBan(selectedUser, '')}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                  >
                    Confirmar Desban
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
