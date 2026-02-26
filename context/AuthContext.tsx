import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Profile } from '../types';

interface AuthContextType {
  session: any | null;
  profile: Profile | null;
  loading: boolean;
  loadingProfile: boolean;
  isLoggingOut: boolean;
  isInitialized: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false); // Nova flag de boot estável
  
  const lastUserId = useRef<string | null>(null);
  const booted = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn("[Auth] Erro ao buscar perfil:", error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error("[Auth] Exceção ao buscar perfil:", err);
      return null;
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (lastUserId.current && !isLoggingOut) {
      const p = await fetchProfile(lastUserId.current);
      setProfile(p);
    }
  }, [isLoggingOut, fetchProfile]);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    const failsafe = setTimeout(() => {
      setLoading(false);
      setIsInitialized(true);
    }, 10000);

    const handleAuthChange = async (event: string, currentSession: any) => {
      const currentId = currentSession?.user?.id || null;
      
      // Evita atualização redundante se for apenas um refresh de token
      if (currentId === lastUserId.current && event === 'TOKEN_REFRESHED') {
        setSession(currentSession);
        return;
      }

      lastUserId.current = currentId;

      if (event === 'SIGNED_OUT' || !currentSession) {
        setSession(null);
        setProfile(null);
        setIsLoggingOut(false);
      } else {
        setSession(currentSession);
        const p = await fetchProfile(currentId);
        setProfile(p);
      }
      
      setLoading(false);
      setIsInitialized(true);
      clearTimeout(failsafe);
    };

    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      handleAuthChange('INITIAL_SESSION', initSession);
    }).catch(err => {
      console.error("[Auth] Erro no getSession inicial:", err);
      setLoading(false);
      setIsInitialized(true);
      clearTimeout(failsafe);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      handleAuthChange(event, newSession);
    });

    return () => {
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      setIsLoggingOut(true);
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[Auth] Erro no SignOut:", e);
    } finally {
      lastUserId.current = null;
      setSession(null);
      setProfile(null);
      setIsLoggingOut(false);
      setLoading(false);
    }
  }, []);

  const contextValue = useMemo(() => ({
    session,
    profile,
    loading,
    loadingProfile,
    isLoggingOut,
    isInitialized,
    signOut,
    refreshProfile
  }), [session, profile, loading, loadingProfile, isLoggingOut, isInitialized, signOut, refreshProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};