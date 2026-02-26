import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Point } from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';

export const Points: React.FC<{ showToast: (m: string, t?: any) => void }> = ({ showToast }) => {
  const { profile, loadingProfile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<Point | null>(null);
  const [formData, setFormData] = useState({ name: '', notes: '', active: true });
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const fetchPoints = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('points')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) {
      showToast('Erro ao carregar pontos', 'error');
    } else {
      setPoints(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPoints(); }, []);

  const handleOpenCreate = () => {
    setEditingPoint(null);
    setFormData({ name: '', notes: '', active: true });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (point: Point) => {
    setEditingPoint(point);
    setFormData({ name: point.name, notes: point.notes || '', active: point.active });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return showToast('Nome é obrigatório', 'error');

    try {
      if (editingPoint) {
        const { error } = await supabase
          .from('points')
          .update(formData)
          .eq('id', editingPoint.id);
        
        if (error) throw error;
        
        setPoints(prev => prev.map(p => p.id === editingPoint.id ? { ...p, ...formData } : p));
        showToast('Ponto atualizado!');
      } else {
        const { data, error } = await supabase
          .from('points')
          .insert([formData])
          .select();
        
        if (error) throw error;
        
        if (data) setPoints(prev => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
        showToast('Ponto criado!');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar', 'error');
    }
  };

  const toggleActive = async (point: Point) => {
    const newStatus = !point.active;
    try {
      const { error } = await supabase
        .from('points')
        .update({ active: newStatus })
        .eq('id', point.id);
      
      if (error) throw error;
      
      setPoints(prev => prev.map(p => p.id === point.id ? { ...p, active: newStatus } : p));
      showToast(newStatus ? 'Ponto ativado' : 'Ponto desativado');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    try {
      const { error } = await supabase
        .from('points')
        .delete()
        .eq('id', idToDelete);
      
      if (error) throw error;
      
      setPoints(prev => prev.filter(p => p.id !== idToDelete));
      showToast('Ponto excluído');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIdToDelete(null);
    }
  };

  if (loading) return <div className="p-20 text-center text-muted font-bold uppercase tracking-widest text-xs">Carregando pontos de missão...</div>;

  return (
    <div>
      <div className="flex flex-col  items-center text-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black">Pontos de Missão</h1>
          <p className="text-muted text-sm font-medium">Gerenciamento de locais de atendimento</p>
        </div>
        {!loadingProfile && isAdmin && (
          <button 
            onClick={handleOpenCreate}
            className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 uppercase tracking-widest text-xs"
          >
            + Novo Ponto
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {points.length > 0 ? (
          points.map(point => (
            <div key={point.id} className="bg-surface border border-border p-6 rounded-2xl flex flex-col justify-between transition-all hover:border-zinc-700">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{point.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${point.active ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-500'}`}>
                    {point.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-sm text-muted mb-4 italic min-h-[40px] font-medium leading-relaxed">
                  {point.notes || 'Sem observações cadastradas.'}
                </p>
              </div>

              {!loadingProfile && isAdmin && (
                <div className="flex items-center gap-2 pt-4 border-t border-border/50">
                  <button onClick={() => handleOpenEdit(point)} className="p-2 hover:bg-white/5 rounded-lg text-muted transition-colors" title="Editar">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => toggleActive(point)} className={`p-2 hover:bg-white/5 rounded-lg transition-colors ${point.active ? 'text-yellow-500' : 'text-green-500'}`} title={point.active ? 'Desativar' : 'Ativar'}>
                    {point.active ? 
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> : 
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    }
                  </button>
                  <button onClick={() => setIdToDelete(point.id)} className="p-2 hover:bg-primary/10 text-primary/60 hover:text-primary rounded-lg ml-auto transition-colors" title="Excluir">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center text-muted border-2 border-dashed border-border rounded-3xl font-bold uppercase tracking-widest text-xs">
            Nenhum ponto cadastrado.
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPoint ? "Editar Ponto" : "Novo Ponto de Missão"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1 tracking-widest">Nome do Ponto</label>
            <input 
              required
              className="w-full bg-background border border-border p-3 rounded-xl text-white outline-none focus:border-primary/50 font-medium"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Ex: Praça da Sé"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1 tracking-widest">Observações / Localização</label>
            <textarea 
              className="w-full bg-background border border-border p-3 rounded-xl text-white outline-none focus:border-primary/50 min-h-[100px] font-medium"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Detalhes sobre o ponto..."
            />
          </div>
          <div className="flex items-center gap-2 py-2">
            <input 
              type="checkbox"
              id="pointActive"
              checked={formData.active}
              onChange={(e) => setFormData({...formData, active: e.target.checked})}
              className="w-4 h-4 rounded accent-primary"
            />
            <label htmlFor="pointActive" className="text-sm font-bold cursor-pointer uppercase tracking-tight">Ponto Ativo (Aparece no Censo)</label>
          </div>
          <button type="submit" className="w-full bg-primary py-4 rounded-xl font-bold shadow-lg shadow-primary/20 uppercase tracking-widest text-sm">
            {editingPoint ? 'Atualizar Ponto' : 'Criar Ponto'}
          </button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={!!idToDelete} 
        onClose={() => setIdToDelete(null)} 
        onConfirm={confirmDelete}
        title="Excluir Ponto"
        message="Tem certeza que deseja excluir este ponto? Isso pode afetar dados históricos."
      />
    </div>
  );
};