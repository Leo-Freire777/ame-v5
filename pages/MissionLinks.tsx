import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { MissionLink } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { getMissionDay, getCutoff } from '../lib/missionDay';
import { useAuth } from '../context/AuthContext';

export const MissionLinks: React.FC<{ showToast: (m: string, t?: any) => void }> = ({ showToast }) => {
  const { profile, loadingProfile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const [links, setLinks] = useState<MissionLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', url: '', mission_day: '' });
  const [hasMore, setHasMore] = useState(true);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const PAGE_SIZE = 25;

  const fetchLinks = async (append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    setTableError(null);
    const from = append ? links.length : 0;
    const to = from + PAGE_SIZE - 1;

    try {
      const { data, error, count } = await supabase
        .from('mission_links')
        .select('*', { count: 'exact' })
        .order('mission_day', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) {
        setTableError("Configuração de banco pendente.");
      } else {
        const newLinks = data || [];
        setLinks(prev => append ? [...prev, ...newLinks] : newLinks);
        setHasMore(count ? (from + newLinks.length) < count : false);
      }
    } catch (err) {
      console.error("[Links] Erro:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const c = await getCutoff();
        setFormData(prev => ({ ...prev, mission_day: getMissionDay(new Date(), c) }));
        await fetchLinks();
      } catch (e) {
        setLoading(false);
      }
    };
    init();
  }, []);

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'link externo';
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('mission_links').insert([formData]);
      if (error) throw error;
      
      showToast('Link registrado!');
      setIsModalOpen(false);
      setFormData({ ...formData, title: '', url: '' });
      fetchLinks();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    try {
      const { error } = await supabase.from('mission_links').delete().eq('id', idToDelete);
      if (error) throw error;
      showToast('Link removido');
      setLinks(prev => prev.filter(l => l.id !== idToDelete));
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIdToDelete(null);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
      <div className="text-muted font-bold uppercase tracking-widest text-[10px]">Carregando links...</div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col items-center text-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter italic">Galeria de Links</h1>
          <p className="text-muted text-sm font-medium">Registros externos e fotos da missão</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-primary/30 uppercase tracking-widest text-xs transition-all active:scale-95"
        >
          + Novo Link
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.length > 0 ? links.map(link => (
          <div key={link.id} className="bg-surface border border-border p-5 rounded-2xl group hover:border-primary/30 transition-all flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-primary/20">
                  {link.mission_day.split('-').reverse().slice(0,2).join('/')}
                </span>
                {!loadingProfile && isAdmin && (
                  <button 
                    onClick={() => setIdToDelete(link.id)} 
                    className="text-muted hover:text-primary p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
              
              <h3 className="font-black text-lg mb-1 uppercase tracking-tight group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                {link.title}
              </h3>
              
              <p className="text-[10px] text-muted font-black uppercase tracking-widest opacity-40 mb-4">
                {getDomain(link.url)}
              </p>
            </div>

            <a 
              href={link.url} 
              target="_blank" 
              rel="noreferrer"
              className="w-full bg-white/5 hover:bg-primary text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-center transition-all border border-white/5 group-hover:border-primary/30"
            >
              Abrir Link
            </a>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-border rounded-3xl bg-surface/30">
            <p className="text-muted font-black uppercase tracking-widest text-xs">Nenhum link na galeria</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Link Externo">
        <form onSubmit={handleCreate} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-muted uppercase mb-2 tracking-widest">Data da Missão</label>
              <input 
                type="date"
                required
                className="w-full bg-background border border-border p-4 rounded-xl font-black text-white outline-none focus:border-primary/50 transition-all"
                value={formData.mission_day}
                onChange={(e) => setFormData({...formData, mission_day: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-muted uppercase mb-2 tracking-widest">Título</label>
              <input 
                required
                className="w-full bg-background border border-border p-4 rounded-xl font-bold text-white outline-none focus:border-primary/50 transition-all"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-muted uppercase mb-2 tracking-widest">URL</label>
              <input 
                type="url"
                required
                placeholder="https://..."
                className="w-full bg-background border border-border p-4 rounded-xl font-medium text-white outline-none focus:border-primary/50 transition-all"
                value={formData.url}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
              />
            </div>
          </div>
          <button 
            type="submit" 
            className="w-full bg-primary py-5 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl transition-all hover:bg-primary-dark"
          >
            Salvar Link
          </button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={!!idToDelete} 
        onClose={() => setIdToDelete(null)} 
        onConfirm={confirmDelete}
        title="Excluir Link"
        message="Deseja remover este link da galeria?"
      />
    </div>
  );
};