import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getMissionDay, getCutoff, formatMissionDay } from '../lib/missionDay';

export const Reports: React.FC = () => {
  const [missionDay, setMissionDay] = useState('');
  const [loading, setLoading] = useState(true);
  const [dayStats, setDayStats] = useState<any[]>([]);
  const [kitStats, setKitStats] = useState({ food: 0, clothing: 0 });
  const [historical, setHistorical] = useState({ avg7: 0, avg30: 0, max: 0 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const c = await getCutoff();
        const md = getMissionDay(new Date(), c);
        setMissionDay(md);

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const dateLimit = sixMonthsAgo.toISOString().split('T')[0];

        // Chamadas paralelas corrigidas
        const [entriesRes, outflowsRes, allEntriesRes] = await Promise.all([
          supabase.from('census_entries').select('id, count, point_id, point:points(name)').eq('mission_day', md),
          supabase.from('kit_outflows').select('food_kits, clothing_kits').eq('mission_day', md),
          supabase.from('census_entries').select('count, mission_day').gte('mission_day', dateLimit)
        ]);

        if (!entriesRes.error) {
          console.log('CENSUS_QUERY_OK');
        }

        setDayStats(entriesRes.data || []);
        
        const totalFood = outflowsRes.data?.reduce((a, b) => a + (b.food_kits || 0), 0) || 0;
        const totalClothing = outflowsRes.data?.reduce((a, b) => a + (b.clothing_kits || 0), 0) || 0;
        setKitStats({ food: totalFood, clothing: totalClothing });

        if (allEntriesRes.data && allEntriesRes.data.length > 0) {
          const sums: Record<string, number> = {};
          allEntriesRes.data.forEach(e => {
            sums[e.mission_day] = (sums[e.mission_day] || 0) + e.count;
          });
          const dailyTotals = Object.values(sums);
          const max = Math.max(...dailyTotals);
          const avg7 = dailyTotals.slice(-7).reduce((a,b) => a+b, 0) / Math.min(dailyTotals.length, 7);
          const avg30 = dailyTotals.slice(-30).reduce((a,b) => a+b, 0) / Math.min(dailyTotals.length, 30);
          setHistorical({ avg7, avg30, max });
        }
      } catch (err) {
        console.error("Reports Error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalDay = dayStats.reduce((a,b) => a + b.count, 0);

  const shareWhatsApp = () => {
    let text = `RELATÓRIO DA MISSÃO — ${formatMissionDay(missionDay)}\n\n`;
    text += `Pessoas atendidas: ${totalDay}\n`;
    dayStats.forEach(s => {
      text += `- ${s.point?.name}: ${s.count}\n`;
    });
    text += `\nKits roupa: ${kitStats.clothing}\nKits comida: ${kitStats.food}\n\nAME — Apoio Missional`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) return <div className="py-20 text-center text-muted uppercase tracking-widest text-[10px]">Processando dados históricos...</div>;

  return (
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

        <div className="space-y-2">
          <p className="text-[9px] text-muted uppercase font-bold px-2 tracking-widest">Por Ponto</p>
          <div className="divide-y divide-border bg-background rounded-2xl overflow-hidden border border-border">
            {dayStats.map(s => (
              <div key={s.id} className="p-4 flex justify-between text-sm">
                <span className="font-bold uppercase tracking-tight">{s.point?.name}</span>
                <span className="text-primary font-black">{s.count}</span>
              </div>
            ))}
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
    </div>
  );
};