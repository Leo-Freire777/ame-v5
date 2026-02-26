import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AppEvent } from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';

export const Events: React.FC<{ showToast: (m: string, t?: any) => void }> = ({ showToast }) => {
  const { profile, loadingProfile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: new Date().toISOString().split('T')[0],
    photos_url: ''
  });

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });
      
      if (error) throw error;
      setEvents(data || []);
    } catch (err: any) {
      console.error("[Events] Fetch error:", err);
      showToast('Erro ao carregar eventos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleOpenCreate = () => {
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      event_date: new Date().toISOString().split('T')[0],
      photos_url: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (event: AppEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      event_date: event.event_date,
      photos_url: event.photos_url || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return showToast('Título é obrigatório', 'error');

    try {
      if (editingEvent) {
        const { error } = await supabase
          .from('events')
          .update(formData)
          .eq('id', editingEvent.id);
        if (error) throw error;
        showToast('Evento atualizado!');
      } else {
        const { error } = await supabase
          .from('events')
          .insert([{ ...formData, created_by: profile?.id }]);
        if (error) throw error;
        showToast('Evento criado!');
      }
      setIsModalOpen(false);
      fetchEvents();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    try {
      // Modificado para usar .select('id') e validar se a linha foi realmente afetada (contornando falsos positivos de RLS)
      const { data, error } = await supabase
        .from('events')
        .delete()
        .eq('id', idToDelete)
        .select('id');
      
      console.log('[EVENTS_DELETE]', { idToDelete, data, error });

      if (error) throw error;

      if (data && data.length > 0) {
        showToast('Evento excluído');
        fetchEvents();
      } else {
        // Caso o delete retorne vazio, provavelmente o usuário não tem permissão de DELETE na política RLS
        showToast('Não foi possível apagar (RLS/bloqueio ou filtro).', 'error');
      }
    } catch (err: any) {
      console.error("[Events] Delete error:", err);
      showToast(err.message || 'Erro ao excluir evento', 'error');
    } finally {
      setIdToDelete(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  if (loading) return (
    <div className="py-20 text-center flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-muted uppercase tracking-widest text-[10px] font-bold">Carregando eventos...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col items-center text-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter italic">Eventos Especiais</h1>
          <p className="text-muted text-sm font-medium">Campanhas e ações extraordinárias da missão</p>
        </div>
        {!loadingProfile && isAdmin && (
          <button 
            onClick={handleOpenCreate}
            className="bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-primary/30 uppercase tracking-widest text-xs transition-all active:scale-95"
          >
            + Novo Evento
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.length > 0 ? events.map(event => (
          <div key={event.id} className="bg-surface border border-border p-6 rounded-2xl group hover:border-primary/30 transition-all flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
                  {formatDate(event.event_date)}
                </span>
                {!loadingProfile && isAdmin && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenEdit(event)} className="p-2 hover:bg-white/5 rounded-lg text-muted transition-colors" title="Editar">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => setIdToDelete(event.id)} className="p-2 hover:bg-primary/10 text-primary/60 hover:text-primary rounded-lg transition-colors" title="Excluir">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                )}
              </div>
              
              <h3 className="font-black text-xl mb-2 uppercase tracking-tight group-hover:text-primary transition-colors leading-tight">
                {event.title}
              </h3>
              
              <p className="text-sm text-muted mb-6 line-clamp-4 font-medium leading-relaxed">
                {event.description || 'Sem descrição cadastrada.'}
              </p>
            </div>

            {event.photos_url && (
              <a 
                href={event.photos_url} 
                target="_blank" 
                rel="noreferrer"
                className="w-full bg-white/5 hover:bg-primary text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-center transition-all border border-white/5 group-hover:border-primary/30"
              >
                Ver Fotos
              </a>
            )}
          </div>
        )) : (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-border rounded-3xl bg-surface/30">
            <p className="text-muted font-black uppercase tracking-widest text-xs">Sem eventos cadastrados.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEvent ? "Editar Evento" : "Novo Evento Especial"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-muted uppercase mb-2 tracking-widest">Título do Evento</label>
              <input 
                required
                className="w-full bg-background border border-border p-4 rounded-xl font-bold text-white outline-none focus:border-primary/50 transition-all"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Ex: Dia das Crianças 2024"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-muted uppercase mb-2 tracking-widest">Data do Evento</label>
              <input 
                type="date"
                required
                className="w-full bg-background border border-border p-4 rounded-xl font-black text-white outline-none focus:border-primary/50 transition-all"
                value={formData.event_date}
                onChange={(e) => setFormData({...formData, event_date: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-muted uppercase mb-2 tracking-widest">Descrição / Tema</label>
              <textarea 
                className="w-full bg-background border border-border p-4 rounded-xl min-h-[120px] outline-none focus:border-primary/50 transition-all font-medium"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Detalhes sobre a ação especial..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-muted uppercase mb-2 tracking-widest">Link para Fotos (URL)</label>
              <input 
                type="url"
                placeholder="https://google.com/drive/..."
                className="w-full bg-background border border-border p-4 rounded-xl font-medium text-white outline-none focus:border-primary/50 transition-all"
                value={formData.photos_url}
                onChange={(e) => setFormData({...formData, photos_url: e.target.value})}
              />
            </div>
          </div>
          <button 
            type="submit" 
            className="w-full bg-primary py-5 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl transition-all hover:bg-primary-dark"
          >
            {editingEvent ? 'Salvar Alterações' : 'Criar Evento'}
          </button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={!!idToDelete} 
        onClose={() => setIdToDelete(null)} 
        onConfirm={confirmDelete}
        title="Excluir Evento"
        message="Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita."
      />
    </div>
  );
};