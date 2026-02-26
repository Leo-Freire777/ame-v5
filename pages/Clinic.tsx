import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ClinicRecord, Person } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { safeWrite, dedupeKeyFor } from '../src/offline/safeWrite';

export const Clinic: React.FC<{ showToast: (m: string, t?: any) => void }> = ({ showToast }) => {
  const { profile } = useAuth();
  const [records, setRecords] = useState<ClinicRecord[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ClinicRecord | null>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({ person_id: '', observation: '' });
  const [restricted, setRestricted] = useState(false);

  // offline state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [savingRecords, setSavingRecords] = useState<Set<string>>(new Set());
  const [queuedRecords, setQueuedRecords] = useState<Set<string>>(new Set());
  const latestRecords = useRef<Record<string, ClinicRecord>>({});

  useEffect(() => {
    latestRecords.current = records.reduce((acc, r) => { if (r.id) acc[r.id] = r; return acc; }, {} as Record<string, ClinicRecord>);
  }, [records]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: recs, error: rErr } = await supabase
        .from('clinic_records')
        .select('*, person:people(name)')
        .order('created_at', { ascending: false });
      
      if (rErr) {
        if (rErr.code === '42501') setRestricted(true);
        throw rErr;
      }
      setRecords(recs || []);
      localStorage.setItem('clinic_cache', JSON.stringify({ records: recs || [] }));
      
      const { data: pps } = await supabase.from('people').select('id, name');
      setPeople(pps || []);
      localStorage.setItem('clinic_people_cache', JSON.stringify(pps || []));
    } catch (e: any) {
      if (e.code !== '42501') {
        console.error("Erro ao carregar clínica:", e.code, e.message);
      }
      // fallback para cache local
      try {
        const cached = localStorage.getItem('clinic_cache');
        if (cached) {
          const { records: cr } = JSON.parse(cached);
          console.warn('[Clinic] usando cache local');
          setRecords(cr);
          showToast('Usando dados em cache (offline)', 'info');
        }
        const cachedPeople = localStorage.getItem('clinic_people_cache');
        if (cachedPeople) {
          setPeople(JSON.parse(cachedPeople));
        }
      } catch {}
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // online / offline listener
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      showToast('Online — sincronizando...', 'info');
      // outbox flush is global via useOutboxSync
    };
    const onOffline = () => {
      setIsOnline(false);
      showToast('Sem conexão', 'warning');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [showToast]);

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setFormData({ person_id: '', observation: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rec: ClinicRecord) => {
    setEditingRecord(rec);
    setFormData({ person_id: rec.person_id, observation: rec.observation });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payloadBase = {
      person_id: formData.person_id,
      observation: formData.observation,
      created_by: profile?.id,
    };

    const persist = async (opArgs: any, idForQueue?: string) => {
      setSavingRecords(prev => new Set(prev).add(idForQueue || '')); // '' for new
      try {
        const res = await safeWrite(opArgs);
        if (res.queued) {
          if (idForQueue) setQueuedRecords(prev => new Set(prev).add(idForQueue));
          showToast('Operação enfileirada (offline)', 'info');
        }
      } catch (e) {
        console.error('[Clinic] persist error', e);
        showToast('Falha ao salvar', 'error');
      } finally {
        setSavingRecords(prev => {
          const next = new Set(prev);
          next.delete(idForQueue || '');
          return next;
        });
      }
    };

    try {
      if (editingRecord && editingRecord.id) {
        const filters = [{ op: 'eq', column: 'id', value: editingRecord.id }];
        await persist({ op: 'update', table: 'clinic_records', payload: formData, filters, dedupeKey: dedupeKeyFor('clinic_records', [editingRecord.id]) }, editingRecord.id);
        setRecords(prev => prev.map(r => r.id === editingRecord.id ? ({ 
          ...r, 
          ...formData,
          person: people.find(p => p.id === formData.person_id) || r.person
        } as ClinicRecord) : r));
        showToast('Atendimento atualizado!');
      } else {
        // new record: generate temporary id to track queue
        const tempId = `tmp-${Date.now()}`;
        await persist({ op: 'insert', table: 'clinic_records', payload: [{ ...payloadBase }] , dedupeKey: dedupeKeyFor('clinic_records', [tempId]) }, tempId);
        setRecords(prev => [{ id: tempId, ...payloadBase } as any, ...prev]);
        showToast('Registro clínico salvo!');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    try {
      await safeWrite({ op: 'delete', table: 'clinic_records', filters: [{ op: 'eq', column: 'id', value: idToDelete }], dedupeKey: dedupeKeyFor('clinic_records', [idToDelete]) });
      setRecords(prev => prev.filter(r => r.id !== idToDelete));
      showToast('Prontuário removido');
    } catch (err: any) {
      console.error('[Clinic] delete error', err);
      showToast(err.message, 'error');
    } finally {
      setIdToDelete(null);
    }
  };

  if (restricted) return (
    <div className="h-96 flex flex-col items-center justify-center text-center p-8 bg-surface border border-border rounded-2xl">
      <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
      </div>
      <h2 className="text-xl font-bold uppercase tracking-widest">Acesso Restrito</h2>
      <p className="text-muted max-w-sm mt-2 font-medium">Você não possui permissão para visualizar o histórico clínico.</p>
    </div>
  );

  return (
    <div>
      <div className="flex flex-col  items-center text-center mb-8">
        <h1 className="text-3xl font-black">Histórico Clínico</h1>
        <button 
          onClick={handleOpenCreate}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all uppercase tracking-widest text-xs"
        >
          + Novo Atendimento
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 text-center text-muted font-bold uppercase tracking-widest text-xs">Carregando prontuários...</div>
        ) : records.length > 0 ? records.map(rec => (
          <div key={rec.id} className="bg-surface border border-border p-6 rounded-2xl group transition-all hover:border-zinc-700">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{rec.person?.name || 'Desconhecido'}</h3>
                <span className="text-[10px] text-muted uppercase font-bold tracking-widest">
                  {new Date(rec.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenEdit(rec)} className="p-2 opacity-0 group-hover:opacity-100 text-muted hover:text-white bg-background border border-border rounded-lg transition-all" title="Editar">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onClick={() => setIdToDelete(rec.id)} className="p-2 opacity-0 group-hover:opacity-100 text-muted hover:text-primary bg-background border border-border rounded-lg transition-all" title="Excluir">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
            <p className="text-muted text-sm leading-relaxed whitespace-pre-wrap font-medium">{rec.observation}</p>
          </div>
        )) : (
          <div className="py-20 text-center text-muted border-2 border-dashed border-border rounded-3xl font-bold uppercase tracking-widest text-xs">
            Nenhum prontuário registrado.
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRecord ? "Editar Atendimento" : "Novo Atendimento Clínico"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1 tracking-widest">Paciente</label>
            <select 
              required
              className="w-full bg-background border border-border p-3 rounded-xl outline-none focus:border-primary/50 font-medium"
              value={formData.person_id}
              onChange={(e) => setFormData({...formData, person_id: e.target.value})}
            >
              <option value="">Selecione...</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1 tracking-widest">Observações Clínicas / Evolução</label>
            <textarea 
              required
              className="w-full bg-background border border-border p-3 rounded-xl min-h-[200px] outline-none focus:border-primary/50 font-medium"
              value={formData.observation}
              onChange={(e) => setFormData({...formData, observation: e.target.value})}
              placeholder="Descreva o atendimento, queixas e procedimentos..."
            />
          </div>
          <button type="submit" className="w-full bg-primary py-4 rounded-xl font-bold shadow-lg shadow-primary/20 uppercase tracking-widest text-sm">
            {editingRecord ? "Salvar Alterações" : "Salvar Prontuário"}
          </button>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={!!idToDelete} 
        onClose={() => setIdToDelete(null)} 
        onConfirm={confirmDelete}
        title="Excluir Prontuário"
        message="Tem certeza que deseja excluir este prontuário permanentemente?"
      />
    </div>
  );
};