import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Profile, Role, Status } from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/Modal';

export const Volunteers: React.FC<{ showToast: (m: string, t?: any) => void }> = ({ showToast }) => {
  const { profile: currentUser, loadingProfile } = useAuth();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  const [volunteers, setVolunteers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'ALL'>('ALL');
  const [editingVolunteer, setEditingVolunteer] = useState<Profile | null>(null);
  const [newName, setNewName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchVolunteers = async () => {
    setLoading(true);
    try {
      let query = supabase.from('profiles').select('*').order('full_name', { ascending: true });

      // Voluntários só veem aprovados
      if (!isAdmin) {
        query = query.eq('status', 'APPROVED');
      }

      const { data, error } = await query;

      if (error) throw error;
      setVolunteers(data || []);
    } catch (err: any) {
      console.error("[Volunteers] fetch error:", err);
      showToast('Erro ao carregar lista de voluntários', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVolunteers();
  }, [isAdmin]);

  const handleUpdateStatus = async (id: string, newStatus: Status) => {
    if (id === currentUser?.id) return showToast('Você não pode alterar seu próprio status.', 'error');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setVolunteers(prev => prev.map(v => v.id === id ? { ...v, status: newStatus } : v));
      showToast(`Status atualizado para ${newStatus}`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateRole = async (id: string, newRole: Role) => {
    if (id === currentUser?.id) return showToast('Você não pode alterar seu próprio nível de acesso.', 'error');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setVolunteers(prev => prev.map(v => v.id === id ? { ...v, role: newRole } : v));
      showToast(`Nível de acesso alterado para ${newRole}`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleEditName = (v: Profile) => {
    if (v.id === currentUser?.id) return showToast('Use as configurações de perfil para mudar seu nome.', 'info');
    setEditingVolunteer(v);
    setNewName(v.full_name);
    setIsModalOpen(true);
  };

  const saveName = async () => {
    if (!editingVolunteer) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName, updated_at: new Date().toISOString() })
        .eq('id', editingVolunteer.id);

      if (error) throw error;

      setVolunteers(prev => prev.map(v => v.id === editingVolunteer.id ? { ...v, full_name: newName } : v));
      showToast('Nome atualizado com sucesso');
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const filteredVolunteers = volunteers.filter(v => {
    const matchesSearch = v.full_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusStyle = (s: Status) => {
    switch (s) {
      case 'APPROVED': return 'bg-green-500/10 text-green-500';
      case 'PENDING': return 'bg-yellow-500/10 text-yellow-500';
      case 'REJECTED': return 'bg-primary/10 text-primary';
      default: return 'bg-zinc-800 text-zinc-500';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center text-center gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Voluntários</h1>
          <p className="text-muted text-sm font-medium">Gestão de membros e permissões da plataforma</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4 bg-surface border border-border p-4 rounded-2xl">
        <div className="flex-1 relative">
          <input 
            type="text"
            placeholder="Pesquisar por nome..."
            className="w-full bg-background border border-border px-10 py-3 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none font-medium transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <svg className="w-5 h-5 absolute left-3 top-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        {!loadingProfile && isAdmin && (
          <select 
            className="bg-background border border-border px-4 py-3 rounded-xl outline-none font-bold text-xs uppercase tracking-widest min-w-[150px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="ALL">Todos Status</option>
            <option value="APPROVED">Aprovados</option>
            <option value="PENDING">Pendentes</option>
            <option value="REJECTED">Rejeitados</option>
          </select>
        )}
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-muted">Nome</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-muted">Função</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-muted">Status</th>
                <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-muted">Membro desde</th>
                {!loadingProfile && isAdmin && <th className="px-6 py-4 text-[10px] uppercase font-black tracking-widest text-muted text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted font-bold uppercase tracking-widest text-xs">Carregando membros...</td>
                </tr>
              ) : filteredVolunteers.length > 0 ? (
                filteredVolunteers.map(v => (
                  <tr key={v.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 font-bold text-sm uppercase tracking-tight">{v.full_name}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted">{v.role}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${getStatusStyle(v.status)}`}>
                        {v.status === 'APPROVED' ? 'Aprovado' : v.status === 'PENDING' ? 'Pendente' : 'Rejeitado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted font-medium">
                      {new Date(v.created_at).toLocaleDateString()}
                    </td>
                    {!loadingProfile && isAdmin && (
                      <td className="px-6 py-4 text-right">
                        {v.id !== currentUser?.id ? (
                          <div className="flex justify-end gap-2">
                            {/* Ações de Status */}
                            {v.status !== 'APPROVED' && (
                              <button 
                                onClick={() => handleUpdateStatus(v.id, 'APPROVED')}
                                className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white rounded-lg transition-all"
                                title="Aprovar"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                              </button>
                            )}
                            {v.status !== 'REJECTED' && (
                              <button 
                                onClick={() => handleUpdateStatus(v.id, 'REJECTED')}
                                className="p-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-all"
                                title="Rejeitar/Bloquear"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                              </button>
                            )}
                            
                            {/* Ações de Role */}
                            <button 
                              onClick={() => handleUpdateRole(v.id, v.role === 'admin' ? 'voluntario' : 'admin')}
                              className="p-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded-lg transition-all"
                              title={v.role === 'admin' ? "Rebaixar para Voluntário" : "Promover a Admin"}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            </button>

                            <button 
                              onClick={() => handleEditName(v)}
                              className="p-2 bg-zinc-800 text-muted hover:text-white rounded-lg transition-all"
                              title="Editar Nome"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] uppercase font-black text-muted tracking-widest italic opacity-50">Você</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted border-2 border-dashed border-border rounded-3xl font-bold uppercase tracking-widest text-xs">Nenhum voluntário encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Editar Dados do Voluntário">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1 tracking-widest">Nome Completo</label>
            <input 
              type="text"
              className="w-full bg-background border border-border p-3 rounded-xl font-medium outline-none focus:border-primary/50 text-white"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <p className="text-[10px] text-muted uppercase font-bold tracking-widest">Atenção: A alteração de e-mail e senha deve ser solicitada ao administrador de TI.</p>
          <button 
            onClick={saveName}
            className="w-full bg-primary py-4 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg shadow-primary/20 transition-all hover:bg-primary-dark"
          >
            Salvar Alterações
          </button>
        </div>
      </Modal>
    </div>
  );
};