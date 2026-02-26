// src/offline/safeWrite.ts
import { supabase } from "../../lib/supabaseClient";
import {
  outboxUpsertDedupe,
  outboxMarkError,
  outboxList,
  outboxDelete,
} from "./outbox";

/**
 * Filters (por enquanto só eq; dá pra expandir depois)
 */
type EqFilter = { op: "eq"; column: string; value: unknown };
type Filters = EqFilter[];

/**
 * Discriminated union (narrowing perfeito pelo `op`)
 */
type InsertArgs = {
  op: "insert";
  table: string;
  payload: any; // object | array
  options?: any;
  dedupeKey: string;
};

type UpsertArgs = {
  op: "upsert";
  table: string;
  payload: any; // object | array
  options?: any; // ex.: { onConflict: "mission_day,point_id" }
  dedupeKey: string;
};

type UpdateArgs = {
  op: "update";
  table: string;
  payload: any;
  filters: Filters;
  dedupeKey: string;
};

type DeleteArgs = {
  op: "delete";
  table: string;
  filters: Filters;
  dedupeKey: string;
};

type RpcArgs = {
  op: "rpc";
  rpcName: string;
  payload?: any;
  dedupeKey: string;
};

export type WriteArgs = InsertArgs | UpsertArgs | UpdateArgs | DeleteArgs | RpcArgs;

/**
 * Helper para dedupeKey (pra você padronizar em todas as abas)
 * Ex.: dedupeKeyFor("census_entries", [mission_day, point_id])
 */
export function dedupeKeyFor(table: string, parts: (string | number)[]) {
  return `${table}:${parts.join("|")}`;
}

/**
 * safeWrite:
 * - offline => enfileira (outbox)
 * - online => tenta agora; se falhar (rede/transiente), enfileira também
 */
export async function safeWrite(args: WriteArgs) {
  // Offline: queue
  if (!navigator.onLine) {
    await outboxUpsertDedupe(args as any);
    return { queued: true };
  }

  try {
    const res = await runNow(args);
    if (res?.error) {
      // fallback: queue em caso de erro (rede, timeouts, etc.)
      await outboxUpsertDedupe(args as any);
      return { queued: true, error: res.error };
    }
    return { queued: false, data: res?.data ?? null };
  } catch (e: any) {
    await outboxUpsertDedupe(args as any);
    return { queued: true, error: e };
  }
}

/**
 * Executa a operação imediatamente (online).
 * Observação: para update/delete você passa filters serializáveis.
 */
async function runNow(args: WriteArgs): Promise<{ data?: any; error?: any }> {
  switch (args.op) {
    case "rpc": {
      const { data, error } = await supabase.rpc(args.rpcName, args.payload ?? {});
      return { data, error };
    }

    case "insert": {
      const { data, error } = await supabase.from(args.table).insert(args.payload).select();
      return { data, error };
    }

    case "upsert": {
      const { data, error } = await supabase
        .from(args.table)
        .upsert(args.payload, args.options ?? {})
        .select();
      return { data, error };
    }

    case "update": {
      let q: any = supabase.from(args.table).update(args.payload);
      for (const f of args.filters) {
        if (f.op === "eq") q = q.eq(f.column, f.value as any);
      }
      const { data, error } = await q.select();
      return { data, error };
    }

    case "delete": {
      let q: any = supabase.from(args.table).delete();
      for (const f of args.filters) {
        if (f.op === "eq") q = q.eq(f.column, f.value as any);
      }
      const { error } = await q;
      return { data: null, error };
    }
  }
}

/**
 * flushOutbox:
 * Reexecuta itens pendentes em ordem.
 * Para no primeiro erro pra evitar martelar requests.
 */
export async function flushOutbox(limit = 50) {
  if (!navigator.onLine) return { flushed: 0 };

  const items = await outboxList(limit);
  let flushed = 0;

  for (const item of items) {
    try {
      const { error } = await runNow(item as any);
      if (error) {
        await outboxMarkError(item.id, String((error as any)?.message ?? error));
        return { flushed, error };
      }
      await outboxDelete(item.id);
      flushed++;
    } catch (e: any) {
      await outboxMarkError(item.id, String(e?.message ?? e));
      return { flushed, error: e };
    }
  }

  return { flushed };
}