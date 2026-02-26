
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LoginLogo } from '../components/BrandLogo';

interface LoginProps {
  onGoToSignup: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const Login: React.FC<LoginProps> = ({ onGoToSignup, showToast }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: any) {
      setError(err.message || "Credenciais inválidas");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-6 overflow-hidden">
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
    </div>
  );
};
