import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { clearOfflinePin, hasOfflinePin } from '../src/offline/offlinePin';
import { MissionEvent } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

export const Settings: React.FC<{ showToast: (m: string, t?: any) => void }> = ({ showToast }) => {
  const { profile, loadingProfile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  
  const [cutoff, setCutoff] = useState('05:00');
  const [verse, setVerse] = useState({ text: '', reference: '' });
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showiOSModal, setShowiOSModal] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({ date: '', title: 'Missão' });
  const [hasPinOffline, setHasPinOffline] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      showToast("App pronto para instalação! Clique no botão 'Instalar App' para prosseguir.", 'success');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    setHasPinOffline(hasOfflinePin());
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      setShowiOSModal(true);
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          showToast('Instalação iniciada!');
        }
        setDeferredPrompt(null);
      });
    } else {
      showToast('Navegador não suporta a instalação direta.', 'info');
    }
  };

  const handleResetOfflinePin = () => {
    if (!hasPinOffline) {
      showToast('Nenhum PIN offline configurado', 'info');
      return;
    }
    clearOfflinePin();
    setHasPinOffline(false);
    showToast('PIN offline removido. Configure um novo PIN no próximo login.', 'success');
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cRes, vRes, eRes] = await Promise.all([
        supabase.from('app_settings').select('*').eq('key', 'mission_day_cutoff').maybeSingle(),
        supabase.from('app_settings').select('*').eq('key', 'daily_verse').maybeSingle(),
        supabase.from('mission_events').select('*').gte('mission_date', new Date().toISOString().split('T')[0]).order('mission_date', { ascending: true })
      ]);

      if (cRes.data) setCutoff(cRes.data.value.cutoff);
      if (vRes.data) setVerse(vRes.data.value);
      setEvents(eRes.data || []);
    } catch (err: any) {
      showToast('Erro ao carregar configurações', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const saveSettings = async (key: string, value: any) => {
    if (!isAdmin) return showToast('Sem permissão', 'error');
    setSaving(true);
    try {
      const { error } = await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
      showToast('Configuração salva!');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddEvent = async () => {
    if (!isAdmin || !newEvent.date) return showToast('Data é obrigatória', 'error');
    setSaving(true);
    try {
      const { data, error } = await supabase.from('mission_events').insert([{ mission_date: newEvent.date, title: newEvent.title, created_by: profile?.id }]).select();
      if (error) throw error;
      showToast('Data adicionada!');
      if (data) setEvents(prev => [...prev, data[0]].sort((a, b) => a.mission_date.localeCompare(b.mission_date)));
      setNewEvent({ date: '', title: 'Missão' });
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteEvent = async () => {
    if (!idToDelete) return;
    try {
      const { error } = await supabase.from('mission_events').delete().eq('id', idToDelete);
      if (error) throw error;
      setEvents(prev => prev.filter(e => e.id !== idToDelete));
      showToast('Evento removido');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIdToDelete(null);
    }
  };

  if (loading) return <div className="p-20 text-center text-muted font-bold uppercase tracking-widest text-xs">Carregando ajustes...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="flex flex-col items-center text-center gap-6 mb-12">
        <h1 className="text-3xl font-black uppercase tracking-tight">Gerenciamento Geral</h1>
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={handleInstallClick}
            className="bg-white text-black px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-200 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Instalar App
          </button>
          {hasPinOffline && (
            <button
              onClick={handleResetOfflinePin}
              className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Resetar PIN Offline
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-8">
          <div className="bg-surface border border-border p-6 rounded-2xl">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 uppercase tracking-widest">Horário de Corte</h3>
            <div className="flex gap-4">
              <input type="time" className="bg-background border border-border p-3 rounded-xl flex-1 text-white outline-none font-bold" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
              {!loadingProfile && isAdmin && <button disabled={saving} onClick={() => saveSettings('mission_day_cutoff', { cutoff })} className="bg-primary hover:bg-primary-dark px-6 rounded-xl font-bold disabled:opacity-50 uppercase tracking-widest text-xs">Salvar</button>}
            </div>
          </div>

          <div className="bg-surface border border-border p-6 rounded-2xl">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 uppercase tracking-widest">Versículo do Dia</h3>
            <div className="space-y-4">
              <textarea placeholder="Texto do versículo..." className="w-full bg-background border border-border p-3 rounded-xl min-h-[80px] outline-none font-medium leading-relaxed" value={verse.text} onChange={(e) => setVerse({...verse, text: e.target.value})} />
              <input placeholder="Referência (Ex: João 3:16)" className="w-full bg-background border border-border p-3 rounded-xl outline-none font-bold tracking-widest" value={verse.reference} onChange={(e) => setVerse({...verse, reference: e.target.value})} />
              {!loadingProfile && isAdmin && <button disabled={saving} onClick={() => saveSettings('daily_verse', { ...verse, day: new Date().toISOString().split('T')[0] })} className="w-full bg-primary py-4 rounded-xl font-bold disabled:opacity-50 shadow-lg shadow-primary/20 uppercase tracking-widest text-sm">Atualizar Versículo</button>}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border p-6 rounded-2xl flex flex-col">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 uppercase tracking-widest">Calendário de Missões</h3>
          {!loadingProfile && isAdmin && (
            <div className="space-y-3 mb-8 bg-background/50 p-4 rounded-xl border border-border">
              <div className="grid grid-cols-2 gap-2">
                 <div className="space-y-1">
                   <label className="text-[10px] uppercase font-bold text-muted tracking-widest">Data</label>
                   <input type="date" className="w-full bg-background border border-border p-2 rounded-lg text-sm outline-none font-bold" value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] uppercase font-bold text-muted tracking-widest">Título</label>
                   <input type="text" className="w-full bg-background border border-border p-2 rounded-lg text-sm outline-none font-bold" value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} />
                 </div>
              </div>
              <button onClick={handleAddEvent} disabled={saving} className="w-full bg-white text-black py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-zinc-200 disabled:opacity-50">+ Adicionar</button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px] pr-2">
            {events.length > 0 ? events.map(event => {
              const [y, m, d] = event.mission_date.split('-');
              return (
                <div key={event.id} className="flex justify-between items-center bg-background p-3 rounded-xl border border-border transition-all hover:border-zinc-700 group">
                  <div><span className="text-primary font-black text-xs">{d}/{m}</span><span className="mx-2 text-zinc-700">|</span><span className="text-sm font-bold text-white uppercase tracking-tight">{event.title}</span></div>
                  {!loadingProfile && isAdmin && <button onClick={() => setIdToDelete(event.id)} className="text-muted hover:text-primary p-1 transition-all opacity-0 group-hover:opacity-100" title="Remover"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}
                </div>
              );
            }) : <p className="text-center py-8 text-xs text-muted italic font-medium">Nenhuma missão futura agendada.</p>}
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={!!idToDelete} 
        onClose={() => setIdToDelete(null)} 
        onConfirm={confirmDeleteEvent}
        title="Remover Evento"
        message="Tem certeza que deseja remover esta data de missão?"
      />
    </div>
  );
};