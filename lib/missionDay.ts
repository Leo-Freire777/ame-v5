
import { supabase } from './supabaseClient';

let cachedCutoff: string | null = null;
let lastFetch: number = 0;
let pendingRequest: Promise<string> | null = null;
const CACHE_DURATION = 1000 * 60 * 10; // 10 minutos

/**
 * Obtém o horário de corte para troca do dia da missão.
 * Implementa deduplicação e cache agressivo para evitar loops.
 */
export async function getCutoff(): Promise<string> {
  const now = Date.now();
  
  if (cachedCutoff && (now - lastFetch < CACHE_DURATION)) {
    return cachedCutoff;
  }

  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = (async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'mission_day_cutoff')
        .maybeSingle();

      const val = (data && data.value && data.value.cutoff) ? data.value.cutoff : "05:00";
      cachedCutoff = val;
      lastFetch = Date.now();
      return val;
    } catch (err) {
      return cachedCutoff || "05:00";
    } finally {
      pendingRequest = null;
    }
  })();

  return pendingRequest;
}

export function getMissionDay(now: Date, cutoffStr: string): string {
  if (!cutoffStr) cutoffStr = "05:00";
  const [cutoffH, cutoffM] = cutoffStr.split(':').map(Number);
  const currentH = now.getHours();
  const currentM = now.getMinutes();
  const missionDate = new Date(now);
  
  if (currentH < (cutoffH || 0) || (currentH === cutoffH && currentM < (cutoffM || 0))) {
    missionDate.setDate(missionDate.getDate() - 1);
  }
  
  return missionDate.toISOString().split('T')[0];
}

export function formatMissionDay(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}
