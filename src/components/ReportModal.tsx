import React, { useState } from 'react';
import { X, AlertTriangle, ShieldCheck, Flag } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedCode?: string;
  reportedName?: string;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  reportedCode = '',
  reportedName = 'Usuário',
}) => {
  const { user } = useAuth();
  const [reason, setReason] = useState('Conteúdo impróprio / Nudez');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportedCode) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId: user?.id || 'guest',
          reportedCode,
          reason,
          details,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          onClose();
        }, 1800);
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao enviar denúncia.');
      }
    } catch (err) {
      setError('Erro de conexão ao enviar denúncia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Denúncia Enviada</h3>
            <p className="text-sm text-zinc-400">
              Obrigado por ajudar a manter o ChatRoulette seguro. Nossa moderação analisará este usuário imediatamente.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800">
              <div className="p-2 bg-red-500/10 text-red-400 rounded-lg">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Denunciar Usuário</h3>
                <p className="text-xs text-zinc-400">
                  {reportedName} ({reportedCode})
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Motivo da Denúncia
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500"
              >
                <option value="Conteúdo impróprio / Nudez">Nudez ou conteúdo sexual explícito</option>
                <option value="Assédio ou ofensas verbais">Assédio, discriminação ou ofensas</option>
                <option value="Spam / Golpes / Publicidade">Spam, links suspeitos ou golpes</option>
                <option value="Ameaças de violência">Ameaças ou comportamento perigoso</option>
                <option value="Outro">Outro comportamento inadequado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Detalhes adicionais (opcional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Descreva o que ocorreu durante a chamada..."
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl text-[11px] text-zinc-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Usuários denunciados com confirmação de infração pelo Painel Admin têm o IP e conta permanentemente banidos.
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-medium rounded-xl text-sm transition disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Confirmar Denúncia'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
