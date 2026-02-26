import React, { Component, useState, ErrorInfo, ReactNode, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineUnlock } from './components/OfflineUnlock';
import { hasOfflinePin } from './src/offline/offlinePin';
import { supabase } from './lib/supabaseClient';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Census } from './pages/Census';
import { People } from './pages/People';
import { Volunteers } from './pages/Volunteers';
import { Points } from './pages/Points';
import { Demands } from './pages/Demands';
import { Clinic } from './pages/Clinic';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { MissionLinks } from './pages/MissionLinks';
import { Outflows } from './pages/Outflows';
import { Events } from './pages/Events';
import { Sidebar } from './components/Sidebar';
import { Toast, ToastType } from './components/Toast';
import { useOutboxSync } from "./src/offline/useOutboxSync";



interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: any; }

// Fixed: Using 'Component' from imports directly ensures TypeScript correctly identifies the base class properties
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    // Initializing state within the constructor
    this.state = { hasError: false, error: null };
  }

  props!: ErrorBoundaryProps;
  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AME_CRITICAL_ERROR:", error, errorInfo);
  }
  render() {
    // Accessing this.state which is now correctly recognized due to direct Component inheritance
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center font-sans">
          <h1 className="text-primary text-4xl font-black mb-4 italic uppercase tracking-tighter">Erro de Sistema</h1>
          <p className="text-muted mb-8 font-medium">Ocorreu um problema ao carregar a interface da AME.</p>
          <pre className="bg-surface border border-border p-4 rounded-xl text-left text-xs text-primary/70 max-w-full overflow-auto mb-8 font-mono">
            {this.state.error?.message || "Erro desconhecido"}
          </pre>
          <button onClick={() => window.location.reload()} className="bg-white text-black px-8 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-all">Recarregar App</button>
        </div>
      );
    }
    // Accessing this.props which is now correctly recognized
    return this.props.children;
  }
}

const AppContent: React.FC = () => { 
  useOutboxSync();  
  const { session, profile, loading, signOut, isLoggingOut } = useAuth();
  const [view, setView] = useState('login'); 
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Estados do Gate Offline
  const [offlineGate, setOfflineGate] = useState<"checking"|"need-online-first"|"need-pin"|"ok">("checking");
  const [offlineUnlocked, setOfflineUnlocked] = useState(false);

  // Gate Offline: Verifica conexão e necessidade de PIN
  useEffect(() => {
    let cancelled = false;

    async function checkOfflineGate() {
      // online: não bloqueia
      if (navigator.onLine) {
        if (!cancelled) {
          setOfflineGate("ok");
          setOfflineUnlocked(true); // online não exige pin
        }
        return;
      }

      // offline: precisa sessão persistida
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session;

      if (!hasSession) {
        if (!cancelled) setOfflineGate("need-online-first");
        return;
      }

      // tem sessão mas exige pin
      const hasPin = hasOfflinePin();
      if (!hasPin) {
        // sem PIN: por segurança, exigir voltar online e criar pin
        if (!cancelled) setOfflineGate("need-online-first");
        return;
      }

      if (!cancelled) {
        setOfflineGate("need-pin");
        setOfflineUnlocked(false);
      }
    }

    checkOfflineGate();

    // ao voltar online, libera
    const onOnline = () => {
      if (!cancelled) {
        setOfflineGate("ok");
        setOfflineUnlocked(true);
        window.location.reload(); // opcional, mas garante estado limpo
      }
    };

    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  }, []);

  const handleLogout = async () => {
    await signOut();
  };

  // RENDERIZAÇÃO DO GATE OFFLINE
  // A) Se offlineGate === "checking": tela pequenininha "Verificando conexão…"
  if (offlineGate === "checking") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <h1 className="text-primary text-2xl font-black italic uppercase tracking-tighter">Verificando Conexão…</h1>
          <p className="text-muted font-medium text-sm">
            Aguarde um momento.
          </p>
        </div>
      </div>
    );
  }

  // B) Se offlineGate === "need-online-first": tela "Sem conexão"
  if (offlineGate === "need-online-first") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <h1 className="text-primary text-2xl font-black italic uppercase tracking-tighter">Sem Conexão</h1>
          <p className="text-muted font-medium mb-4">
            Você precisa estar conectado à internet para fazer seu primeiro login e criar um PIN offline.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-white text-black px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-200 transition-all"
          >
            Tentar Novamente
          </button>
          <p className="text-[10px] text-muted/70 uppercase font-bold tracking-widest">
            Aguardando conexão...
          </p>
        </div>
      </div>
    );
  }

  // C) Se offlineGate === "need-pin" e offlineUnlocked === false: renderizar <OfflineUnlock />
  if (offlineGate === "need-pin" && !offlineUnlocked) {
    return (
      <OfflineUnlock onUnlocked={() => { 
        setOfflineUnlocked(true); 
        setOfflineGate("ok"); 
      }} />
    );
  }

  // D) Se offlineGate !== "ok", renderize tela de espera
  if (offlineGate !== "ok") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">Aguarde...</p>
        </div>
      </div>
    );
  }

  // MEDIDA 1: App Shell Estável
  // Não retornamos null ou spinners que desmontam a árvore React principal.
  // Em vez disso, renderizamos o shell base e sobrepomos o estado de loading.

  // Caso: Autenticação Inicial ou Logout
  if (!session || isLoggingOut) {
    if (loading && !isLoggingOut) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Aguarde...</p>
          </div>
        </div>
      );
    }
    return view === 'signup' ? <Signup onGoToLogin={() => setView('login')} /> : <Login onGoToSignup={() => setView('signup')} showToast={showToast} />;
  }

  // Caso: Perfil Pendente ou Rejeitado (UI Simplificada sem Sidebar)
  if (profile?.status === 'PENDING' || profile?.status === 'REJECTED') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-border p-8 rounded-2xl text-center">
          <h1 className="text-2xl font-bold mb-2 uppercase italic">{profile.status === 'PENDING' ? 'Acesso Pendente' : 'Acesso Negado'}</h1>
          <p className="text-muted mb-6 font-medium text-sm">
            {profile.status === 'PENDING' ? 'Seu cadastro está em análise pela coordenação.' : 'Sua solicitação não foi aprovada.'}
          </p>
          <button onClick={handleLogout} className="text-primary hover:underline font-bold uppercase tracking-widest text-[10px]">Sair do Sistema</button>
        </div>
      </div>
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'points': return <Points showToast={showToast} />;
      case 'outflows': return <Outflows showToast={showToast} />;
      case 'census': return <Census showToast={showToast} />;
      case 'people': return <People showToast={showToast} />;
      case 'volunteers': return <Volunteers showToast={showToast} />;
      case 'demands': return <Demands showToast={showToast} />;
      case 'clinic': return <Clinic showToast={showToast} />;
      case 'reports': return <Reports />;
      case 'settings': return <Settings showToast={showToast} />;
      case 'links': return <MissionLinks showToast={showToast} />;
      case 'events': return <Events showToast={showToast} />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-white font-sans animate-in fade-in duration-700">
      {/* Overlay de carregamento não-destrutivo para mudanças de estado internas */}
      {loading && !isLoggingOut && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center pointer-events-none transition-opacity duration-300">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {isSidebarOpen && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => { setActiveTab(tab); setIsSidebarOpen(false); }} 
        onSignOut={handleLogout} 
        isOpen={isSidebarOpen} 
      />

      <main className="flex-1 min-w-0 md:ml-64 p-4 md:p-8 pb-16 relative">
     <header className="flex md:hidden items-center justify-between mb-6 p-3 bg-surface border border-border rounded-xl">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-lg text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="text-[10px] font-black tracking-[0.3em] uppercase opacity-40">AME</div>
          <div className="w-10"></div>
        </header>

        {/* Conteúdo dinâmico com transição suave */}
        <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-1 duration-500">
          {renderActiveTab()}
        </div>
      </main>

      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-zinc-800 pointer-events-none z-40 select-none uppercase font-black tracking-widest">Powered by Leo Freire</div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <ErrorBoundary>
      <AuthProvider><AppContent /></AuthProvider>
    </ErrorBoundary>
  );
}
