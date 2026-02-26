import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Demand, Person, Point } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';

export const Demands: React.FC<{ showToast: (m: string, t?: any) => void }> = ({ showToast }) => {
  const { profile } = useAuth();
  const [demands, setDemands] = useState<Demand[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDemand, setEditingDemand] = useState<Demand | null>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    person_id: '',
    point_id: '',
    description: '',
    priority: 'media' as any,
    status: 'pendente' as any
  });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dRes, pRes, ptRes] = await Promise.all([
        supabase.from('demands').select('*, person:people(name), point:points(name)').order('created_at', { ascending: false }),
        supabase.from('people').select('id, name'),
        supabase.from('points').select('id, name')
      ]);
      setDemands(dRes.data || []);
      setPeople(pRes.data || []);
      setPoints(ptRes.data || []);
    } catch (err: any) {
      console.error("Erro ao carregar demandas:", err.code, err.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleOpenCreate = () => {
    setEditingDemand(null);
    setFormData({
      person_id: '',
      point_id: '',
      description: '',
      priority: 'media',
      status: 'pendente'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (demand: Demand) => {
    setEditingDemand(demand);
    setFormData({
      person_id: demand.person_id,
      point_id: demand.point_id,
      description: demand.description,
      priority: demand.priority,
      status: demand.status
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDemand) {
        const { error } = await supabase
          .from('demands')
          .update(formData)
          .eq('id', editingDemand.id);
        
        if (error) throw error;
        
        setDemands(prev => prev.map(d => d.id === editingDemand.id ? ({ 
          ...d, 
          ...formData,
          person: people.find(p => p.id === formData.person_id) || d.person,
          point: points.find(p => p.id === formData.point_id) || d.point
        } as Demand) : d));
        showToast('Demanda atualizada!');
      } else {
        const { data, error } = await supabase
          .from('demands')
          .insert([{ ...formData, created_by: profile?.id }])
          .select('*, person:people(name), point:points(name)');
        
        if (error) throw error;
        
        if (data) setDemands(prev => [data[0], ...prev]);
        showToast('Demanda registrada!');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    try {
      const { error } = await supabase
        .from('demands')
        .delete()
        .eq('id', idToDelete);
      
      if (error) throw error;
      
      setDemands(prev => prev.filter(d => d.id !== idToDelete));
      showToast('Demanda excluída');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIdToDelete(null);
    }
  };

  const getPriorityColor = (p: string) => {
    if (p === 'alta') return 'text-primary bg-primary/10';
    if (p === 'media') return 'text-yellow-500 bg-yellow-500/10';
    return 'text-green-500 bg-green-500/10';
  };

  return (
    <div>
      <div className="flex flex-col  items-center text-center mb-8">
        <h1 className="text-3xl font-black">Demandas da Missão</h1>
        <button 
          onClick={handleOpenCreate}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all uppercase tracking-widest text-xs"
        >
          + Nova Demanda
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center text-muted font-bold uppercase tracking-widest text-xs">Carregando demandas...</div>
        ) : demands.map(demand => (
          <div key={demand.id} className="bg-surface border border-border p-6 rounded-2xl flex flex-col md:flex-row gap-6 transition-all hover:border-zinc-700 group">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${getPriorityColor(demand.priority)} tracking-widest`}>
                  {demand.priority}
                </span>
                <span className="text-[10px] text-muted uppercase font-bold bg-border px-2 py-0.5 rounded tracking-widest">
                  {demand.status.replace('_', ' ')}
                </span>
              </div>
              <h3 className="text-lg font-bold">{demand.person?.name || 'Pessoa desconhecida'}</h3>
              <p className="text-muted text-sm mt-1 font-medium leading-relaxed">{demand.description}</p>
              <p className="text-[10px] text-muted mt-3 uppercase tracking-widest font-bold">
                Ponto: {demand.point?.name || 'Não informado'} • Em: {new Date(demand.created_at).toLocaleDateString()}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={() => handleOpenEdit(demand)} className="p-2 opacity-0 group-hover:opacity-100 bg-background border border-border hover:bg-white/5 rounded-lg text-muted transition-all" title="Editar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button onClick={() => setIdToDelete(demand.id)} className="p-2 opacity-0 group-hover:opacity-100 bg-background border border-border hover:bg-primary/10 hover:text-primary rounded-lg text-muted transition-all" title="Excluir">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingDemand ? "Editar Demanda" : "Registrar Demanda"}>
        <form onSubmit={handleSubmit} className="space-y-4 font-medium">
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1 tracking-widest">Pessoa</label>
            <select 
              required
              className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:border-primary/50"
              value={formData.person_id}
              onChange={(e) => setFormData({...formData, person_id: e.target.value})}
            >
              <option value="">Selecione...</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1 tracking-widest">Ponto de Origem</label>
            <select 
              required
              className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:border-primary/50"
              value={formData.point_id}
              onChange={(e) => setFormData({...formData, point_id: e.target.value})}
            >
              <option value="">Selecione...</option>
              {points.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted uppercase mb-1 tracking-widest">Prioridade</label>
              <select 
                className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:border-primary/50"
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted uppercase mb-1 tracking-widest">Status</label>
              <select 
                className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:border-primary/50"
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value as any})}
              >
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluida">Concluída</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1 tracking-widest">Descrição do Pedido / Necessidade</label>
            <textarea 
              required
              className="w-full bg-background border border-border p-3 rounded-xl min-h-[100px] outline-none focus:border-primary/50"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>
          <button type="submit" className="w-full bg-primary py-4 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg shadow-primary/20 transition-all">
            {editingDemand ? "Salvar Alterações" : "Criar Demanda"}
          </button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={!!idToDelete} 
        onClose={() => setIdToDelete(null)} 
        onConfirm={confirmDelete}
        title="Excluir Demanda"
        message="Tem certeza que deseja excluir esta demanda permanentemente?"
      />
    </div>
  );
};