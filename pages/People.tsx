import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Person } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { safeWrite, dedupeKeyFor } from '../src/offline/safeWrite';

export const People: React.FC<{ showToast: (m: string, t?: any) => void }> = ({ showToast }) => {
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', notes: '' });
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [savingPeople, setSavingPeople] = useState<Set<string>>(new Set());
  const [queuedPeople, setQueuedPeople] = useState<Set<string>>(new Set());
  const latestPeople = useRef<Record<string, Person>>({});

  useEffect(() => {
    latestPeople.current = people.reduce((acc, p) => { if (p.id) acc[p.id] = p; return acc; }, {} as Record<string, Person>);
  }, [people]);

  const fetchPeople = useCallback(async (searchTerm = '') => {
    setLoading(true);
    try {
      let query = supabase
        .from('people')
        .select('*')
        .order('name', { ascending: true })
        .limit(50);
      
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setPeople(data || []);
      if (!searchTerm) {
        localStorage.setItem('people_cache', JSON.stringify(data || []));
      }
    } catch (err: any) {
      console.error('[People] fetch', err);
      try {
        const cached = localStorage.getItem('people_cache');
        if (cached) {
          setPeople(JSON.parse(cached));
          showToast('Usando cache local (offline)', 'info');
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { 
    const timer = setTimeout(() => {
      fetchPeople(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchPeople]);

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); showToast('Online — sincronizando...', 'info'); };
    const onOffline = () => { setIsOnline(false); showToast('Sem conexão', 'warning'); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const persist = async (args: any, idForQueue?: string) => {
      setSavingPeople(prev => new Set(prev).add(idForQueue || ''));
      try {
        const res = await safeWrite(args);
        if (res.queued && idForQueue) {
          setQueuedPeople(prev => new Set(prev).add(idForQueue));
          showToast('Operação enfileirada (offline)', 'info');
        }
      } catch (e) {
        console.error('[People] persist', e);
        showToast('Erro ao salvar', 'error');
      } finally {
        setSavingPeople(prev => { const n = new Set(prev); n.delete(idForQueue || ''); return n; });
      }
    };

    try {
      if (editingPerson && editingPerson.id) {
        const filters = [{ op: 'eq', column: 'id', value: editingPerson.id }];
        await persist({ op: 'update', table: 'people', payload: formData, filters, dedupeKey: dedupeKeyFor('people', [editingPerson.id]) }, editingPerson.id);
        showToast('Pessoa atualizada!');
      } else {
        const tempId = `tmp-${Date.now()}`;
        await persist({ op: 'insert', table: 'people', payload: [formData], dedupeKey: dedupeKeyFor('people', [tempId]) }, tempId);
        showToast('Pessoa cadastrada!');
      }
      setIsModalOpen(false);
      fetchPeople(search);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    try {
      await safeWrite({ op: 'delete', table: 'people', filters: [{ op: 'eq', column: 'id', value: idToDelete }], dedupeKey: dedupeKeyFor('people', [idToDelete]) });
      showToast('Pessoa excluída');
      fetchPeople(search);
    } catch (err: any) {
      console.error('[People] delete', err);
      showToast(err.message, 'error');
    } finally {
      setIdToDelete(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col  items-center text-center gap-4 mb-8">
        <h1 className="text-3xl font-black">Pessoas</h1>
        <button onClick={() => { setEditingPerson(null); setFormData({name:'', phone:'', notes:''}); setIsModalOpen(true); }} className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs">
          + Nova Pessoa
        </button>
      </div>

      <div className="mb-6">
        <input 
          type="text"
          placeholder="Pesquisar por nome (carregando até 50 resultados)..."
          className="w-full bg-surface border border-border px-4 py-3 rounded-xl outline-none font-medium transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-10 text-center text-muted uppercase tracking-widest text-[10px]">Buscando registros...</div>
        ) : people.length > 0 ? (
          people.map(person => (
            <div key={person.id} className="bg-surface border border-border p-5 rounded-2xl hover:border-zinc-700 transition-all group relative">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-lg group-hover:text-primary transition-colors pr-8">{person.name}</h3>
                <span className="text-[10px] text-muted uppercase font-bold tracking-widest">#{person.id.slice(0, 4)}</span>
              </div>
              <p className="text-sm text-muted mt-2 font-medium flex items-center gap-2 italic">
                {person.phone || 'Sem telefone'}
              </p>
              <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingPerson(person); setFormData({name:person.name, phone:person.phone||'', notes:person.notes||''}); setIsModalOpen(true); }} className="text-xs font-bold uppercase tracking-widest text-muted hover:text-white">Editar</button>
                <button onClick={() => setIdToDelete(person.id)} className="text-xs font-bold uppercase tracking-widest text-muted hover:text-primary">Excluir</button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-10 text-center text-muted uppercase tracking-widest text-[10px]">Nenhuma pessoa encontrada.</div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPerson ? "Editar" : "Novo Cadastro"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required className="w-full bg-background border border-border p-3 rounded-xl outline-none" placeholder="Nome Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          <input className="w-full bg-background border border-border p-3 rounded-xl outline-none" placeholder="Telefone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          <textarea className="w-full bg-background border border-border p-3 rounded-xl outline-none min-h-[100px]" placeholder="Notas" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
          <button type="submit" className="w-full bg-primary py-4 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg">Salvar</button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={!!idToDelete} 
        onClose={() => setIdToDelete(null)} 
        onConfirm={confirmDelete}
        title="Excluir Cadastro"
        message="Tem certeza que deseja excluir este cadastro permanentemente?"
      />
    </div>
  );
};