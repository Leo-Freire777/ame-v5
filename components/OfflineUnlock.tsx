import React, { useState } from 'react';
import { verifyOfflinePin } from '../src/offline/offlinePin';

interface OfflineUnlockProps {
  onUnlocked: () => void;
}

export const OfflineUnlock: React.FC<OfflineUnlockProps> = ({ onUnlocked }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      setError('Insira o PIN');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isValid = await verifyOfflinePin(pin);
      if (!isValid) {
        setError('PIN inválido');
        setPin('');
        setLoading(false);
        return;
      }

      // PIN correto - libera acesso
      onUnlocked();
    } catch (err: any) {
      setError(err.message || 'Erro ao verificar PIN');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-surface border border-border rounded-2xl p-8 text-center space-y-6">
          {/* Ícone / Título */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white">
              Desbloqueio Offline
            </h1>
            <p className="text-xs text-muted font-medium uppercase tracking-widest">
              Insira seu PIN de acesso local
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs font-bold uppercase tracking-widest text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••"
                maxLength={8}
                className="w-full bg-background border border-border rounded-xl px-6 py-4 text-white text-center text-2xl font-bold focus:outline-none focus:border-primary transition-colors tracking-[0.2em]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !pin}
              className="w-full bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-black py-4 rounded-xl transition-all uppercase tracking-widest text-sm shadow-lg disabled:cursor-not-allowed"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>

          {/* Info texto */}
          <p className="text-[10px] text-muted/60 font-bold uppercase tracking-widest">
            Você está offline. Use seu PIN para acessar.
          </p>
        </div>
      </div>
    </div>
  );
};
