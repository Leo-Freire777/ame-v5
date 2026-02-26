import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Point, KitOutflow } from '../types';
import { getMissionDay, getCutoff, formatMissionDay } from '../lib/missionDay';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';

export const Outflows: React.FC<{ showToast: (m: string, t?: any) => void }> = ({ showToast }) => {
  const { profile, loadingProfile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');
  const [points, setPoints] = useState<Point[]>([]);
  const [entries, setEntries] = useState<Record<string, Partial<KitOutflow>>>({});
  const [history, setHistory] = useState<KitOutflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [missionDay, setMissionDay] = useState('');
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const c = await getCutoff().catch(() => "05:00");
      const md = getMissionDay(new Date(), c);
      setMissionDay(md);

      const { data: pts } = await supabase.from('points').select('*').eq('active', true);
      setPoints(pts || []);

      const { data: outflows } = await supabase.from('kit_outflows').select('*').eq('mission_day', md);
      const entryMap: Record<string, Partial<KitOutflow>> = {};
      outflows?.forEach(o => {
        entryMap[o.point_id] = o;
      });
      setEntries(entryMap);
      setLoading(false);
    };
    init();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('kit_outflows')
      .select('*, point:points(name)')
      .order('mission_day', { ascending: false })
      .limit(100);
    
    if (error) {
      showToast('Erro ao carregar histórico', 'error');
    } else {
      setHistory(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  const handleUpdate = (pointId: string, field: 'food_kits' | 'clothing_kits', value: number) => {
    setEntries(prev => ({
      ...prev,
      [pointId]: {
        ...prev[pointId],
        [field]: value
      }
    }));
  };

  const handleSave = async (pointId: string) => {
    setSaving(pointId);
    const entry = entries[pointId] || {};
    
    try {
      const payload = {
        mission_day: missionDay,
        point_id: pointId,
        food_kits: entry.food_kits || 0,
        clothing_kits: entry.clothing_kits || 0,
        recorded_by: profile?.id,
      };

      const { error } = await supabase
        .from('kit_outflows')
        .upsert(payload, { onConflict: 'mission_day,point_id' });

      if (error) throw error;
      showToast('Saída salva com sucesso!');
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(null);
    }
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    try {
      const { error } = await supabase.from('kit_outflows').delete().eq('id', idToDelete);
      if (error) throw error;
      showToast('Registro excluído');
      fetchHistory();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIdToDelete(null);
    }
  };

  if (loading && activeTab === 'register') return <div className="p-8 text-center text-muted uppercase font-bold text-xs tracking-widest">Carregando pontos...</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col items-center text-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Saídas de Kits</h1>
          <p className="text-muted text-sm font-medium">Controle de suprimentos distribuídos em campo</p>
        </div>
        
        {!loadingProfile && isAdmin && (
          <div className="flex bg-surface p-1 rounded-xl border border-border">
            <button 
              onClick={() => setActiveTab('register')}
              className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'register' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}
            >
              Lançamento
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}
            >
              Gerenciar
            </button>
          </div>
        )}
      </div>

      {activeTab === 'register' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-surface border border-border p-4 rounded-2xl">
            <span className="text-xs font-black uppercase tracking-widest text-muted">Missão de hoje: {formatMissionDay(missionDay)}</span>
            <div className="flex gap-4 text-right">
              <div>
                <p className="text-[10px] text-muted uppercase font-black">Total Comida</p>
                <p className="text-xl font-black text-primary">
                  {Object.values(entries).reduce((sum: number, e: Partial<KitOutflow>) => sum + (e.food_kits || 0), 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase font-black">Total Roupas</p>
                <p className="text-xl font-black text-primary">
                  {Object.values(entries).reduce((sum: number, e: Partial<KitOutflow>) => sum + (e.clothing_kits || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {points.map(point => {
              const entry = entries[point.id] || { food_kits: 0, clothing_kits: 0 };
              return (
                <div key={point.id} className="bg-surface border border-border p-5 rounded-2xl flex flex-col lg:flex-row gap-6 items-center hover:border-zinc-700 transition-all group">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{point.name}</h3>
                    <p className="text-xs text-muted truncate max-w-[250px] font-medium">{point.notes || 'Sem detalhes'}</p>
                  </div>

                  <div className="flex flex-wrap justify-center gap-8 items-center">
                    <div className="flex flex-col items-center gap-2">
                      <label className="text-[10px] text-muted uppercase font-black tracking-widest">Kit Alimentação</label>
                      <div className="flex items-center gap-3 bg-background border border-border p-1 rounded-xl">
                        <button 
                          onClick={() => handleUpdate(point.id, 'food_kits', Math.max(0, (entry.food_kits || 0) - 1))}
                          className="w-10 h-10 rounded-lg hover:bg-border text-xl font-bold transition-colors"
                        >–</button>
                        <input 
                          type="number" 
                          value={entry.food_kits || 0}
                          onChange={(e) => handleUpdate(point.id, 'food_kits', Math.max(0, parseInt(e.target.value) || 0))}
                          className="bg-transparent w-12 text-center font-black focus:outline-none text-lg"
                        />
                        <button 
                          onClick={() => handleUpdate(point.id, 'food_kits', (entry.food_kits || 0) + 1)}
                          className="w-10 h-10 rounded-lg hover:bg-border text-xl font-bold transition-colors"
                        >+</button>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <label className="text-[10px] text-muted uppercase font-black tracking-widest">Kit Roupa</label>
                      <div className="flex items-center gap-3 bg-background border border-border p-1 rounded-xl">
                        <button 
                          onClick={() => handleUpdate(point.id, 'clothing_kits', Math.max(0, (entry.clothing_kits || 0) - 1))}
                          className="w-10 h-10 rounded-lg hover:bg-border text-xl font-bold transition-colors"
                        >–</button>
                        <input 
                          type="number" 
                          value={entry.clothing_kits || 0}
                          onChange={(e) => handleUpdate(point.id, 'clothing_kits', Math.max(0, parseInt(e.target.value) || 0))}
                          className="bg-transparent w-12 text-center font-black focus:outline-none text-lg"
                        />
                        <button 
                          onClick={() => handleUpdate(point.id, 'clothing_kits', (entry.clothing_kits || 0) + 1)}
                          className="w-10 h-10 rounded-lg hover:bg-border text-xl font-bold transition-colors"
                        >+</button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSave(point.id)}
                    disabled={saving === point.id}
                    className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-black px-8 py-4 rounded-xl min-w-[140px] shadow-lg shadow-primary/20 uppercase tracking-widest text-xs transition-all"
                  >
                    {saving === point.id ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background/50 border-b border-border">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">Data</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">Ponto</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">Comida</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">Roupas</th>
                  {!loadingProfile && isAdmin && <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.length > 0 ? history.map(h => (
                  <tr key={h.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 text-xs font-black uppercase tracking-widest text-primary">{formatMissionDay(h.mission_day)}</td>
                    <td className="px-6 py-4 text-sm font-bold uppercase tracking-tight">{h.point?.name}</td>
                    <td className="px-6 py-4">
                       <span className="bg-green-500/10 text-green-500 px-2 py-1 rounded font-black text-xs">{h.food_kits}</span>
                    </td>
                    <td className="px-6 py-4">
                       <span className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded font-black text-xs">{h.clothing_kits}</span>
                    </td>
                    {!loadingProfile && isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setIdToDelete(h.id)}
                          className="p-2 text-muted hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    )}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center text-muted font-bold uppercase tracking-widest text-[10px]">Nenhum registro encontrado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!idToDelete} 
        onClose={() => setIdToDelete(null)} 
        onConfirm={confirmDelete}
        title="Excluir Registro"
        message="Tem certeza que deseja excluir este registro de saída permanentemente?"
      />
    </div>
  );
};