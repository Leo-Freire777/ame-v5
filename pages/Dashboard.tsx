import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getMissionDay, getCutoff, formatMissionDay } from '../lib/missionDay';
import { DailyVerse } from '../types';

export const Dashboard: React.FC = () => {
  const [missionDay, setMissionDay] = useState('');
  const [cutoff, setCutoff] = useState('05:00');
  const [verse, setVerse] = useState<DailyVerse | null>(null);
  const [nextMission, setNextMission] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalAtendidos: 0,
    demandasPendentes: 0,
    clinicRecords: 0,
    totalRoupa: 0,
    totalComida: 0,
    kitsComidaHoje: 0,
    kitsRoupaHoje: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const c = await getCutoff().catch(() => "05:00");
        setCutoff(c);
        const md = getMissionDay(new Date(), c);
        setMissionDay(md);
        
        const todayStr = new Date().toISOString().split('T')[0];

        const [
          verseRes,
          eventRes,
          censusRes,
          outflowRes,
          demandRes,
          clinicRes
        ] = await Promise.all([
          supabase.from('app_settings').select('value').eq('key', 'daily_verse').maybeSingle(),
          supabase.from('mission_events').select('mission_date').gte('mission_date', todayStr).order('mission_date', { ascending: true }).limit(1).maybeSingle(),
          supabase.from('census_entries').select('count').eq('mission_day', md),
          supabase.from('kit_outflows').select('food_kits, clothing_kits').eq('mission_day', md),
          supabase.from('demands').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
          supabase.from('clinic_records').select('*', { count: 'exact', head: true })
        ]);

        if (verseRes.data) setVerse(verseRes.data.value);
        if (eventRes.data) {
          const [y, m, d] = eventRes.data.mission_date.split('-');
          setNextMission(`${d}/${m}`);
        }

        const totalAtendidos = censusRes.data?.reduce((acc, curr) => acc + (curr.count || 0), 0) || 0;
        const kitsComidaHoje = outflowRes.data?.reduce((acc, curr) => acc + (curr.food_kits || 0), 0) || 0;
        const kitsRoupaHoje = outflowRes.data?.reduce((acc, curr) => acc + (curr.clothing_kits || 0), 0) || 0;

        setStats({
          totalAtendidos: totalAtendidos,
          demandasPendentes: demandRes.count || 0,
          clinicRecords: clinicRes.count || 0,
          totalRoupa: kitsRoupaHoje,
          totalComida: kitsComidaHoje,
          kitsComidaHoje,
          kitsRoupaHoje
        });

        console.log('CENSUS_QUERY_OK');
      } catch (err) {
        console.error("Dashboard Otimização Error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) return (
    <div className="animate-pulse space-y-8">
      <div className="h-12 bg-surface rounded-xl w-48"></div>
      <div className="grid grid-cols-2 gap-4 items-stretch">
        {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-surface rounded-xl border border-border"></div>)}
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen">
      <div 
        className="pointer-events-none select-none"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '70%',
          maxWidth: '900px',
          height: '100%',
          opacity: 0.06,
          zIndex: 0,
      
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'contain',
        }}
      />

      <div className="relative z-10 space-y-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 text-center md:text-left relative">
            <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Próxima missão: {nextMission || '—'}
              </span>
            </div>

           {verse ? (
  <div className="mx-auto text-center max-w-3xl relative 
                  bg-gradient-to-br from-primary/10 to-transparent
                  border border-primary/20
                  p-10 rounded-3xl shadow-2xl overflow-hidden">

    {/* aspas decorativas */}
    <div className="absolute text-primary/10 text-[120px] font-serif top-0 left-4 select-none">
      "
    </div>

    <div className="absolute text-primary/10 text-[120px] font-serif bottom-[-40px] right-6 select-none">
      "
    </div>

    {/* conteúdo */}
    <p className="relative text-white font-serif text-xl md:text-2xl leading-relaxed italic px-6">
      {verse.text}
    </p>

    <span className="relative text-primary text-xs font-black mt-6 block uppercase tracking-[0.35em]">
      {verse.reference}
    </span>

    {/* glow suave */}
    <div className="absolute inset-0 rounded-3xl ring-1 ring-primary/10 pointer-events-none"></div>

  </div>
) : (
  <p className="text-muted text-sm italic font-medium text-center">
    "Ide por todo o mundo e pregai o evangelho a toda criatura."
  </p>
)}
          </div>
        </div>

        <h1 className="text-3xl font-black">Missão Hoje: <span className="text-primary">{formatMissionDay(missionDay)}</span></h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="bg-surface border border-border p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 text-white opacity-5 transition-transform group-hover:scale-125">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <p className="text-muted text-[10px] uppercase font-bold tracking-widest mb-1">Pessoas Atendidas</p>
            <p className="text-4xl font-black">{stats.totalAtendidos}</p>
            <p className="text-[9px] text-muted mt-5 font-bold uppercase tracking-tighter">MÉTRICA DO CENSO</p>
          </div>

          <div className="bg-surface border border-border p-6 rounded-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 text-white opacity-5 transition-transform group-hover:scale-125">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            </div>
            <p className="text-muted text-[10px] uppercase font-bold tracking-widest mb-1">Kits Alimentação (Hoje)</p>
            <p className="text-4xl font-black text-primary">{stats.kitsComidaHoje > 0 ? stats.kitsComidaHoje : '—'}</p>
            <p className="text-[9px] text-muted mt-5 font-bold uppercase">SAÍDA DIÁRIA</p>
          </div>

          <div className="bg-surface border border-border p-6 rounded-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 text-white opacity-5 transition-transform group-hover:scale-125">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h18M3 11h18M3 15h18M3 19h18" /></svg>
            </div>
            <p className="text-muted text-[10px] uppercase font-bold tracking-widest mb-1">Kits Roupas (Hoje)</p>
            <p className="text-4xl font-black text-primary">{stats.kitsRoupaHoje > 0 ? stats.kitsRoupaHoje : '—'}</p>
            <p className="text-[9px] text-muted mt-5 font-bold uppercase">SAÍDA DIÁRIA</p>
          </div>

          <div className="bg-surface border border-border p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 text-white opacity-5 transition-transform group-hover:scale-125">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <p className="text-muted text-[10px] uppercase font-bold tracking-widest mb-1">Demandas Pendentes</p>
            <p className="text-4xl font-black text-primary">{stats.demandasPendentes}</p>
            <p className="text-[9px] text-muted mt-5 font-bold uppercase">AGUARDANDO AÇÃO</p>
          </div>

          <div className="bg-surface border border-border p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 text-white opacity-5 transition-transform group-hover:scale-125">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </div>
            <p className="text-muted text-[10px] uppercase font-bold tracking-widest mb-1">Registros Clínicos</p>
            <p className="text-4xl font-black">{stats.clinicRecords}</p>
            <p className="text-[9px] text-muted mt-5 font-bold uppercase">TOTAL HISTÓRICO</p>
          </div>
        </div>
      </div>
    </div>
  );
};