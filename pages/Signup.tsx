
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { LoginLogo } from '../components/BrandLogo';

interface SignupProps {
  onGoToLogin: () => void;
}

export const Signup: React.FC<SignupProps> = ({ onGoToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (signUpError) throw signUpError;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <svg className="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">Cadastro Enviado!</h2>
          <p className="text-muted mb-8">Seu pedido de acesso foi registrado. Aguarde a aprovação de um administrador.</p>
          <button
            onClick={onGoToLogin}
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-8">
          <LoginLogo />
        </div>
        
        <h2 className="text-2xl font-bold mb-6 text-center">Solicitar Acesso</h2>
        
        {error && (
          <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Nome Completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="Ex: João Silva"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="seu@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="Crie uma senha forte"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Cadastrar"}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-muted">
          Já tem conta?{" "}
          <button 
            onClick={onGoToLogin}
            className="text-primary hover:underline font-medium"
          >
            Fazer Login
          </button>
        </div>
      </div>
    </div>
  );
};
