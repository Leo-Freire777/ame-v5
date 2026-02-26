
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LoginLogo } from '../components/BrandLogo';
import { hasOfflinePin, setOfflinePin } from '../src/offline/offlinePin';

interface LoginProps {
  onGoToSignup: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const Login: React.FC<LoginProps> = ({ onGoToSignup, showToast }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para criação de PIN offline
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    setError(null);
    
    try { 
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

      // Após login bem-sucedido, verifica se existe PIN offline
      const hasPinAlready = hasOfflinePin();
      if (!hasPinAlready) {
        // Mostra tela de criação de PIN
        setShowPinSetup(true);
      }
      // Se já tem PIN, o redirecionamento é feito automaticamente (AuthContext detecção)
    } catch (err: any) {
      setError(err.message || "Credenciais inválidas");
      setLoading(false);
    }
  };

  const handleSaveOfflinePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    // Validações
    if (!newPin || !confirmPin) {
      setPinError('Preencha ambos os campos');
      return;
    }

    if (newPin.length < 4 || newPin.length > 8) {
      setPinError('PIN deve ter entre 4 e 8 dígitos');
      return;
    }

    if (!/^\d+$/.test(newPin)) {
      setPinError('PIN deve conter apenas números');
      return;
    }

    if (newPin !== confirmPin) {
      setPinError('Os PINs não coincidem');
      return;
    }

    setSavingPin(true);
    try {
      await setOfflinePin(newPin);
      showToast?.('PIN offline criado com sucesso!', 'success');
      setShowPinSetup(false);
      setNewPin('');
      setConfirmPin('');
      // Login é concluído, AppContent redireciona automaticamente
    } catch (err: any) {
      setPinError(err.message || 'Erro ao salvar PIN');
    } finally {
      setSavingPin(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-6 overflow-hidden">
      {/* Tela de Criação de PIN Offline */}
      {showPinSetup && (
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter">
              Criar PIN Offline
            </h1>
            <p className="text-xs text-muted font-medium uppercase tracking-widest">
              Para usar o app offline, configure um PIN de 4-8 dígitos
            </p>
          </div>

          {pinError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs font-bold uppercase tracking-widest text-center">
              {pinError}
            </div>
          )}

          <form onSubmit={handleSaveOfflinePin} className="space-y-4">
            <div>
              <label className="text-[10px] text-muted font-bold uppercase tracking-widest block mb-2">
                PIN (4-8 dígitos)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••"
                maxLength={8}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-5 py-4 text-white text-center text-2xl font-bold focus:outline-none focus:border-zinc-500 transition-all placeholder:text-zinc-600 tracking-[0.2em]"
              />
            </div>

            <div>
              <label className="text-[10px] text-muted font-bold uppercase tracking-widest block mb-2">
                Confirmar PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••"
                maxLength={8}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-5 py-4 text-white text-center text-2xl font-bold focus:outline-none focus:border-zinc-500 transition-all placeholder:text-zinc-600 tracking-[0.2em]"
              />
            </div>

            <button
              type="submit"
              disabled={savingPin || !newPin || !confirmPin}
              className="w-full bg-white hover:bg-zinc-200 text-black font-black py-4 rounded-xl transition-all shadow-xl disabled:opacity-50 mt-6 uppercase tracking-[0.15em] text-sm"
            >
              {savingPin ? "Salvando..." : "Salvar PIN"}
            </button>
          </form>

          <p className="text-[10px] text-muted/60 font-bold uppercase tracking-widest text-center">
            Este PIN será usado para acessar o app quando offline.
          </p>
        </div>
      )}

      {/* Tela de Login Normal */}
      {!showPinSetup && (
        <>
          {/* 1. LOGO */}
          <div className="mb-2 pl-4">
            <LoginLogo className="scale-110 md:scale-125" />
          </div>

          {/* 4. FORMULÁRIO */}
          <div className="w-full max-w-sm mt-2">
            {error && (
              <div className="bg-primary/20 border border-primary/30 text-primary p-3 rounded-lg mb-6 text-xs text-center font-bold uppercase tracking-widest">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-zinc-500 transition-all placeholder:text-zinc-600"
                  placeholder="E-mail de acesso"
                  required
                />
              </div>
              <div className="group">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-zinc-500 transition-all placeholder:text-zinc-600"
                  placeholder="Senha"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white hover:bg-zinc-200 text-black font-black py-5 rounded-xl transition-all shadow-xl disabled:opacity-50 mt-6 uppercase tracking-[0.15em] text-sm"
              >
                {loading ? "Autenticando..." : "Entrar no Sistema"}
              </button>
            </form>

            {/* 5. CADASTRAR */}
            <div className="mt-8 text-center">
              <button 
                onClick={onGoToSignup}
                className="text-white/60 hover:text-white uppercase tracking-[0.25em] text-[10px] font-bold transition-all border-b border-white/10 pb-1"
              >
                Solicitar Acesso à Plataforma
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
