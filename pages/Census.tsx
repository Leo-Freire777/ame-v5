import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Point, CensusEntry } from '../types';
import { getMissionDay, getCutoff, formatMissionDay } from '../lib/missionDay';
import { useAuth } from '../context/AuthContext';
import { safeWrite, dedupeKeyFor } from '../src/offline/safeWrite';

export const Census: React.FC<{ showToast: (m: string, t?: any) => void }> = ({ showToast }) => {
  const { profile } = useAuth();
  const [points, setPoints] = useState<Point[]>([]);
  const [entries, setEntries] = useState<Record<string, Partial<CensusEntry>>>({});
  const [queuedPoints, setQueuedPoints] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingPoints, setSavingPoints] = useState<Set<string>>(new Set());
  const [missionDay, setMissionDay] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const debounceTimers = useRef<Record<string, number>>({});
  const latestEntries = useRef<Record<string, Partial<CensusEntry>>>({});
  const syncTriggered = useRef(false);
  const didInit = useRef(false);

  useEffect(() => {
    latestEntries.current = entries;
  }, [entries]);

 const init = useCallback(async () => {
    setLoading(true);
    
    try {
      const c = await getCutoff();
      const md = getMissionDay(new Date(), c);
      setMissionDay(md);

      // Tenta carregar do servidor
      const [ptsRes, entsRes] = await Promise.all([
        supabase.from('points').select('*').eq('active', true).order('name'),
        supabase
          .from('census_entries')
          .select('id, point_id, count, error_report, mission_day')
          .eq('mission_day', md),
      ]);

      const err = ptsRes.error ?? entsRes.error;
      if (err) {
        console.error("[Census:init] Supabase error:", err);
        throw err;
      }

      // Sucesso: salvar no localStorage como cache
      const entryMap: Record<string, Partial<CensusEntry>> = {};
      for (const e of (entsRes.data ?? [])) {
        entryMap[e.point_id] = e;
      }
      localStorage.setItem('census_cache', JSON.stringify({
        points: ptsRes.data ?? [],
        entries: entryMap,
        missionDay: md
      }));
      
      setPoints(ptsRes.data ?? []);
      setEntries(entryMap);
    } catch (err: any) {
      console.error("[Census:init] Error:", err?.message);
      
      // Fallback: tentar carregar do cache local
      try {
        const cached = localStorage.getItem('census_cache');
        if (cached) {
          const { points: cachedPoints, entries: cachedEntries, missionDay: cachedMD } = JSON.parse(cached);
          console.warn("[Census:init] Usando cache local");
          setPoints(cachedPoints);
          setEntries(cachedEntries);
          setMissionDay(cachedMD);
          showToast('Usando dados em cache (offline)', 'info');
        } else {
          throw new Error('Sem cache local disponível');
        }
      } catch (cacheErr) {
        console.error("[Census:init] Cache fallback failed:", cacheErr);
        showToast('Erro ao carregar dados', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    init();
  }, [init]);

  const persistSave = useCallback(async (pointId: string, valueToSave: number, errorReport: string | null) => {
    setSavingPoints(prev => new Set(prev).add(pointId));

    try {
      const payload = {
        mission_day: missionDay,
        point_id: pointId,
        count: valueToSave,
        recorded_by: profile?.id,
        error_report: errorReport || null,
      };

      const res = await safeWrite({
        op: "upsert",
        table: "census_entries",
        payload,
        options: { onConflict: "mission_day,point_id" },
        dedupeKey: dedupeKeyFor("census_entries", [payload.mission_day, payload.point_id]),
      });

      // UI: mostra "Pendente" quando enfileirar (offline)
      if (res.queued) {
        setQueuedPoints(prev => {
          const next = new Set(prev);
          next.add(pointId);
          return next;
        });
      } else {
        setQueuedPoints(prev => {
          const next = new Set(prev);
          next.delete(pointId);
          return next;
        });
      }
    } catch (err: any) {
      console.error("[Census] Auto-save error:", err);
      showToast("Falha ao salvar censo", "error");

      // se deu erro, marca como pendente (para não mentir no UI)
      setQueuedPoints(prev => {
        const next = new Set(prev);
        next.add(pointId);
        return next;
      });
    } finally {
      setSavingPoints(prev => {
        const next = new Set(prev);
        next.delete(pointId);
        return next;
      });
    }
  }, [missionDay, profile?.id, showToast]);

  // Listener de conectividade
  useEffect(() => {
    const handleOnline = async () => {
      console.log("[Census] Conectado novamente");
      setIsOnline(true);
      showToast('Conectado - sincronizando...', 'info');
      
      // Aguarda um pouco para garantir que o navigator.onLine está estável
      await new Promise(r => setTimeout(r, 500));
      
      // Se há pontos enfileirados, tenta sincronizar
      if (queuedPoints.size > 0) {
        console.log(`[Census] Sincronizando ${queuedPoints.size} pontos`);
        // A sincronização acontece automaticamente via persistSave
        // Aqui apenas re-dispara as salvas pendentes
        for (const pointId of Array.from(queuedPoints)) {
          const entry = latestEntries.current[pointId] || {};
          persistSave(pointId, entry.count || 0, entry.error_report || null);
        }
      }
    };
    
    const handleOffline = () => {
      console.log("[Census] Desconectado");
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queuedPoints, persistSave, showToast]);

  const handleUpdateCount = (pointId: string, value: number) => {
    const newCount = Math.max(0, value);
    
    // Update local imediato (sem flicker)
    setEntries(prev => ({ 
      ...prev, 
      [pointId]: { ...prev[pointId], count: newCount } 
    }));

    if (debounceTimers.current[pointId]) {
      window.clearTimeout(debounceTimers.current[pointId]);
    }

    debounceTimers.current[pointId] = window.setTimeout(() => {
      const currentEntry = latestEntries.current[pointId] || {};
      persistSave(pointId, newCount, currentEntry.error_report || null);
    }, 800);
  };

  const handleUpdateError = (pointId: string, text: string) => {
    setEntries(prev => ({ 
      ...prev, 
      [pointId]: { ...prev[pointId], error_report: text } 
    }));
    
    if (debounceTimers.current[pointId]) {
      window.clearTimeout(debounceTimers.current[pointId]);
    }
    debounceTimers.current[pointId] = window.setTimeout(() => {
      const currentEntry = latestEntries.current[pointId] || {};
      persistSave(pointId, currentEntry.count || 0, text);
    }, 1500);
  };

  if (loading) return (
    <div className="py-20 text-center flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-muted uppercase tracking-widest text-[10px] font-bold">Acessando banco...</p>
    </div>
  );

  const totalAtendidos = Object.values(entries).reduce((sum: number, e: Partial<CensusEntry>) => sum + (e.count || 0), 0);

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex flex-col items-center text-center mb-10 border-b border-border pb-6 gap-4">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-center">Censo DiáriO</h1>
          <p className="text-muted font-bold uppercase tracking-widest text-[10px] mt-1">
            Missão: <span className="text-white">{formatMissionDay(missionDay)}</span>
          </p>
        </div>
        <div className="bg-surface border border-border px-8 py-5 rounded-2xl text-center min-w-[200px] shadow-xl">
          <p className="text-[10px] text-muted uppercase font-black tracking-widest mb-1">Total de Atendidos</p>
          <p className="text-5xl font-black text-primary leading-none">
            {totalAtendidos}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {points.map(point => {
          const entry = entries[point.id] || { count: 0, error_report: '' };
          const isSaving = savingPoints.has(point.id);
          const isQueued = queuedPoints.has(point.id);

          return (
            <div key={point.id} className="bg-surface border border-border p-6 rounded-2xl flex flex-col gap-6 hover:border-zinc-700 transition-all group">
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-2xl uppercase tracking-tighter group-hover:text-primary transition-colors">{point.name}</h3>
                    {(isSaving || isQueued) && (
                      <div className="flex gap-1 items-center">
                        <span className="w-1 h-1 bg-primary rounded-full animate-pulse"></span>
                        <span className="text-[8px] text-primary uppercase font-bold tracking-tighter">
                          {isSaving ? "Sync" : "Pendente"}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted uppercase font-bold tracking-widest opacity-50 mt-1">Contagem Local de Campo</p>
                </div>

                <div className="flex flex-col items-center gap-2 w-full md:w-auto">
                  <div className="flex items-center gap-4 bg-background border border-border p-1 rounded-2xl shadow-inner w-full md:w-auto justify-between md:justify-start">
                    <button 
                      onClick={() => handleUpdateCount(point.id, (entry.count || 0) - 1)} 
                      className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-border font-bold text-2xl transition-all active:scale-75"
                    >–</button>
                    <input 
                      type="number" 
                      value={entry.count || 0} 
                      onChange={e => handleUpdateCount(point.id, parseInt(e.target.value) || 0)} 
                      className="bg-transparent w-16 text-center font-black text-3xl outline-none" 
                    />
                    <button 
                      onClick={() => handleUpdateCount(point.id, (entry.count || 0) + 1)} 
                      className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-border font-bold text-2xl transition-all active:scale-75"
                    >+</button>
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-4 border-t border-border/50">
                <input 
                  type="text"
                  placeholder="Relatar observação ou ocorrência..."
                  className="w-full bg-background border border-border px-4 py-3 rounded-xl text-sm outline-none focus:border-primary/50 transition-all font-medium"
                  value={entry.error_report || ''}
                  onChange={e => handleUpdateError(point.id, e.target.value)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};