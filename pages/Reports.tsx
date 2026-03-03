import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getMissionDay, getCutoff, formatMissionDay, toLocalISO } from '../lib/missionDay';

// helper para calcular médias e pico por migrações de missão; não usa datas corridas
function average(arr: number[]) {
  if (arr.length === 0) return 0;
  const sum = arr.reduce((s, n) => s + n, 0);
  return sum / arr.length;
}


export const Reports: React.FC = () => {
  const [missionDay, setMissionDay] = useState('');
  const [loading, setLoading] = useState(true);
  const [dayStats, setDayStats] = useState<any[]>([]);
  const [kitStats, setKitStats] = useState({ food: 0, clothing: 0 });
  const [historical, setHistorical] = useState({ avg7: 0, avg30: 0, max: 0 });
  const [recentDays, setRecentDays] = useState<{ md: string; count: number }[]>([]);

  // Kit reporting state
  const [activeTab, setActiveTab] = useState<'census' | 'kits'>('census');
  const [kitDays, setKitDays] = useState<{ md: string; food: number; clothing: number; total: number }[]>([]);
  const [selectedKitDay, setSelectedKitDay] = useState<string | null>(null);
  const [kitDayDetails, setKitDayDetails] = useState<any[]>([]);
  const [points, setPoints] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const c = await getCutoff();
        const md = getMissionDay(new Date(), c);
        setMissionDay(md);

      // busca entradas dos últimos 6 meses e agrega por mission_day
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      // usamos iso local para evitar deslocamento de dia em fusos negativos
      const sixMonthsAgoISO = toLocalISO(sixMonthsAgo);

      // ===== CENSUS DATA =====
      const { data: raw, error: rawErr } = await supabase
        .from('census_entries')
        .select('mission_day, count')
        .gte('mission_day', sixMonthsAgoISO);
      if (rawErr) throw rawErr;

      const totalsByDay = new Map<string, number>();
      (raw ?? []).forEach(r => {
        const md = String(r.mission_day);
        const v = Number(r.count ?? 0);
        totalsByDay.set(md, (totalsByDay.get(md) || 0) + v);
      });

      // ===== KIT DATA (Aggregate by mission_day & point) =====
      const { data: kitRaw, error: kitErr } = await supabase
        .from('kit_outflows')
        .select('mission_day, point_id, food_kits, clothing_kits')
        .gte('mission_day', sixMonthsAgoISO);
      if (kitErr) throw kitErr;

      // Map of points for later lookup
      const { data: pointsData } = await supabase.from('points').select('id, name');
      const pointsMap = new Map<string, string>();
      pointsData?.forEach(p => pointsMap.set(p.id, p.name));
      setPoints(pointsMap);

      // Aggregate kits by day
      const kitsByDay = new Map<string, { food: number; clothing: number; total: number }>();
      (kitRaw ?? []).forEach(k => {
        const md = String(k.mission_day);
        const f = Number(k.food_kits ?? 0);
        const c = Number(k.clothing_kits ?? 0);
        const existing = kitsByDay.get(md) || { food: 0, clothing: 0, total: 0 };
        kitsByDay.set(md, {
          food: existing.food + f,
          clothing: existing.clothing + c,
          total: existing.total + f + c
        });
      });

      // Filter kit days (only where total > 0) and sort descending
      const kitDaysSorted = Array.from(kitsByDay.entries())
        .filter(([_, stats]) => stats.total > 0)
        .map(([md, stats]) => ({ md, ...stats }))
        .sort((a, b) => (a.md < b.md ? 1 : -1))
        .slice(0, 30); // Show recent 30 days with kits
      setKitDays(kitDaysSorted);

      // build a full descending sequence of mission days from today back to six months ago
      const allMissionDays: string[] = [];
      const seen = new Set<string>();
      const today = new Date();
      const cutoffDate = new Date(sixMonthsAgoISO);
      let cur = new Date(today);
      while (true) {
        const md = getMissionDay(cur, c);
        if (md < sixMonthsAgoISO) break;
        if (!seen.has(md)) {
          seen.add(md);
          allMissionDays.push(md);
        }
        cur.setDate(cur.getDate() - 1);
      }
      // already descending because we started from today

      // arrays used for statistics
      const last30Days = allMissionDays.slice(0, 30).map(md => totalsByDay.get(md) ?? 0);
      const last7Days  = last30Days.slice(0, 7);

      // debug: imprimir dias de missão usados para média
      console.log('REPORT_DEBUG allMissionDays', allMissionDays);
      console.log('REPORT_DEBUG last7Days', last7Days);
      console.log('REPORT_DEBUG last30Days', last30Days);

      // ignore days with zero (SEM MISSÃO) when computing averages
      const media7  = average(last7Days.filter(n => n > 0));
      const media30 = average(last30Days.filter(n => n > 0));
      const picoHistorico = last30Days.length ? Math.max(...last30Days) : 0;

      setHistorical({ avg7: media7, avg30: media30, max: picoHistorico });

      // prepare array of last 30 mission days with counts (omit zeroes)
      let recent = allMissionDays.slice(0, 30).map(md => ({ md, count: totalsByDay.get(md) ?? 0 }));
      recent = recent.filter(d => d.count > 0);
      setRecentDays(recent);
      console.log('REPORT_DEBUG recentDays', recent);

      const [entriesRes, outflowsRes] = await Promise.all([
        supabase.from('census_entries').select('id, count, point_id, point:points(name)').eq('mission_day', md),
        supabase.from('kit_outflows').select('food_kits, clothing_kits').eq('mission_day', md),
      ]);
      console.log('REPORT_DEBUG dayStats query', entriesRes.error, entriesRes.data);

        if (!entriesRes.error) {
          console.log('CENSUS_QUERY_OK');
        }

        setDayStats(entriesRes.data || []);
        
        const totalFood = outflowsRes.data?.reduce((a, b) => a + (b.food_kits || 0), 0) || 0;
        const totalClothing = outflowsRes.data?.reduce((a, b) => a + (b.clothing_kits || 0), 0) || 0;
        setKitStats({ food: totalFood, clothing: totalClothing });
      } catch (err) {
        console.error("Reports Error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalDay = dayStats.reduce((a,b) => a + b.count, 0);

  // Fetch detailed kit report for a specific day
  const fetchKitDayDetails = async (day: string) => {
    try {
      const { data, error } = await supabase
        .from('kit_outflows')
        .select('point_id, food_kits, clothing_kits')
        .eq('mission_day', day);
      if (error) throw error;
      setKitDayDetails(data || []);
      setSelectedKitDay(day);
    } catch (err) {
      console.error('[Reports] fetchKitDayDetails:', err);
    }
  };

  // Build share text based on active tab
  const buildShareText = (): string => {
    if (activeTab === 'kits' && selectedKitDay) {
      let text = `AME — Relatório de Kits (${formatMissionDay(selectedKitDay)})\n\n`;
      
      // Group by point
      const byPoint = new Map<string, { food: number; clothing: number }>();
      kitDayDetails.forEach(k => {
        const pid = k.point_id;
        const existing = byPoint.get(pid) || { food: 0, clothing: 0 };
        byPoint.set(pid, {
          food: existing.food + (k.food_kits || 0),
          clothing: existing.clothing + (k.clothing_kits || 0)
        });
      });
      
      // Render by point
      let totalFood = 0, totalClothing = 0;
      byPoint.forEach((stats, pid) => {
        const pointName = points.get(pid) || 'Desconhecido';
        text += `${pointName}: Comida ${stats.food} | Roupa ${stats.clothing} | Total ${stats.food + stats.clothing}\n`;
        totalFood += stats.food;
        totalClothing += stats.clothing;
      });
      
      text += `\nTOTAL DO DIA: Comida ${totalFood} | Roupa ${totalClothing} | Total ${totalFood + totalClothing}\n\nAME — Apoio Missional`;
      return text;
    } else {
      // Census share (original)
      let text = `RELATÓRIO DA MISSÃO — ${formatMissionDay(missionDay)}\n\n`;
      text += `Pessoas atendidas: ${totalDay}\n`;
      dayStats.forEach(s => {
        text += `- ${s.point?.name}: ${s.count}\n`;
      });
      text += `\nKits roupa: ${kitStats.clothing}\nKits comida: ${kitStats.food}\n\nAME — Apoio Missional`;
      return text;
    }
  };

  const shareWhatsApp = () => {
    if (activeTab === 'kits' && !selectedKitDay) {
      alert('Selecione um dia para compartilhar o relatório de kits');
      return;
    }
    const text = buildShareText();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) return <div className="py-20 text-center text-muted uppercase tracking-widest text-[10px]">Processando dados históricos...</div>;

  // Render census tab (original content)
  const censusModeContent = (
    <div className="space-y-12">
      <section className="bg-surface border border-border p-8 rounded-3xl">
        <div className="flex flex-col items-center text-center gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black italic">Relatório do Dia</h1>
            <p className="text-muted font-medium">{formatMissionDay(missionDay)}</p>
          </div>
          <button onClick={shareWhatsApp} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg">
            Compartilhar WhatsApp
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-background border border-border rounded-2xl">
            <p className="text-[9px] text-muted uppercase font-bold mb-1">Atendidos</p>
            <p className="text-3xl font-black">{totalDay}</p>
          </div>
          <div className="p-4 bg-background border border-border rounded-2xl">
            <p className="text-[9px] text-muted uppercase font-bold mb-1">Roupas</p>
            <p className="text-3xl font-black">{kitStats.clothing}</p>
          </div>
          <div className="p-4 bg-background border border-border rounded-2xl">
            <p className="text-[9px] text-muted uppercase font-bold mb-1">Comida</p>
            <p className="text-3xl font-black">{kitStats.food}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted mb-6">Desempenho (6 meses)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface border border-border p-6 rounded-2xl">
            <p className="text-muted text-[10px] font-bold uppercase mb-1">Média 7d</p>
            <p className="text-4xl font-black text-white">{historical.avg7.toFixed(1)}</p>
          </div>
          <div className="bg-surface border border-border p-6 rounded-2xl">
            <p className="text-muted text-[10px] font-bold uppercase mb-1">Média 30d</p>
            <p className="text-4xl font-black text-white">{historical.avg30.toFixed(1)}</p>
          </div>
          <div className="bg-surface border border-border p-6 rounded-2xl border-primary/20">
            <p className="text-muted text-[10px] font-bold uppercase mb-1">Pico Histórico</p>
            <p className="text-4xl font-black text-primary">{historical.max}</p>
          </div>
        </div>
      </section>
      <section className="mt-8">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted mb-4">Últimos 30 dias</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center text-sm">
          {recentDays.map(d => (
            <div key={d.md} className="flex flex-col items-center">
              <span className="font-bold">{formatMissionDay(d.md)}</span>
              <span className={d.count === 0 ? 'text-red-500' : 'text-primary font-black'}>
                {d.count === 0 ? 'SEM MISSÃO' : d.count}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  // Render kits tab content
  const kitsModeContent = selectedKitDay ? (
    // Kit day detail view
    <div className="space-y-8">
      <section className="bg-surface border border-border p-8 rounded-3xl">
        <div className="flex flex-col items-center text-center gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black italic">Relatório de Kits</h1>
            <p className="text-muted font-medium">{formatMissionDay(selectedKitDay)}</p>
          </div>
          <button 
            onClick={() => setSelectedKitDay(null)} 
            className="bg-zinc-700 hover:bg-zinc-600 text-white px-6 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px]"
          >
            ← Voltar
          </button>
        </div>

        {/* Kits by point table */}
        <div className="space-y-4">
          <div className="overflow-x-auto border border-border rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="p-4 text-left font-black text-muted uppercase tracking-widest text-[10px]">Ponto</th>
                  <th className="p-4 text-center font-black text-muted uppercase tracking-widest text-[10px]">Comida</th>
                  <th className="p-4 text-center font-black text-muted uppercase tracking-widest text-[10px]">Roupa</th>
                  <th className="p-4 text-center font-black text-muted uppercase tracking-widest text-[10px]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(() => {
                  const byPoint = new Map<string, { food: number; clothing: number }>();
                  kitDayDetails.forEach(k => {
                    const pid = k.point_id;
                    const existing = byPoint.get(pid) || { food: 0, clothing: 0 };
                    byPoint.set(pid, {
                      food: existing.food + (k.food_kits || 0),
                      clothing: existing.clothing + (k.clothing_kits || 0)
                    });
                  });

                  let totalFood = 0, totalClothing = 0;
                  const rows = Array.from(byPoint.entries()).map(([pid, stats]) => {
                    totalFood += stats.food;
                    totalClothing += stats.clothing;
                    return (
                      <tr key={pid} className="bg-surface hover:bg-background/50 transition-colors">
                        <td className="p-4 font-bold">{points.get(pid) || 'Desconhecido'}</td>
                        <td className="p-4 text-center text-primary font-black">{stats.food}</td>
                        <td className="p-4 text-center text-primary font-black">{stats.clothing}</td>
                        <td className="p-4 text-center text-primary font-black font-black">{stats.food + stats.clothing}</td>
                      </tr>
                    );
                  });

                  rows.push(
                    <tr key="total" className="bg-background border-t-2 border-primary/20">
                      <td className="p-4 font-black uppercase text-primary">TOTAL</td>
                      <td className="p-4 text-center text-primary font-black text-lg">{totalFood}</td>
                      <td className="p-4 text-center text-primary font-black text-lg">{totalClothing}</td>
                      <td className="p-4 text-center text-primary font-black text-lg">{totalFood + totalClothing}</td>
                    </tr>
                  );

                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <button onClick={shareWhatsApp} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg">
            Compartilhar WhatsApp
          </button>
        </div>
      </section>
    </div>
  ) : (
    // Kit days list view
    <div className="space-y-8">
      <section className="bg-surface border border-border p-8 rounded-3xl">
        <div className="flex flex-col items-center text-center gap-4 mb-8">
          <h1 className="text-3xl font-black italic">Kits (por ponto)</h1>
          <p className="text-muted text-sm">Selecione um dia para ver o relatório detalhado</p>
        </div>

        {kitDays.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kitDays.map(d => (
              <button
                key={d.md}
                onClick={() => fetchKitDayDetails(d.md)}
                className="p-4 bg-background border border-border hover:border-primary rounded-2xl transition-all hover:bg-background/80 text-center"
              >
                <div className="font-bold text-primary mb-2">{formatMissionDay(d.md)}</div>
                <div className="text-[10px] text-muted uppercase font-bold tracking-widest mb-1">Comida: {d.food}</div>
                <div className="text-[10px] text-muted uppercase font-bold tracking-widest mb-2">Roupa: {d.clothing}</div>
                <div className="text-sm font-black text-white">Total: {d.total}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-muted uppercase tracking-widest text-[10px]">
            Sem registros de kits nos últimos 6 meses
          </div>
        )}
      </section>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tab selector */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => { setActiveTab('census'); setSelectedKitDay(null); }}
          className={`px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all ${
            activeTab === 'census'
              ? 'bg-primary text-white shadow-lg'
              : 'bg-surface border border-border text-muted hover:text-white'
          }`}
        >
          Censo
        </button>
        <button
          onClick={() => { setActiveTab('kits'); setSelectedKitDay(null); }}
          className={`px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all ${
            activeTab === 'kits'
              ? 'bg-primary text-white shadow-lg'
              : 'bg-surface border border-border text-muted hover:text-white'
          }`}
        >
          Kits (por ponto)
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'census' ? censusModeContent : kitsModeContent}
    </div>
  );
}