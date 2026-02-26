import React, { useState } from "react";
import { setOfflinePin } from "../src/offline/offlinePin";

interface Props {
  onDone: () => void;
}

export default function OfflinePinSetup({ onDone }: Props) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{4,8}$/.test(pin)) {
      setError("PIN deve conter entre 4 e 8 dígitos.");
      return;
    }

    if (pin !== confirm) {
      setError("PINs não coincidem.");
      return;
    }

    await setOfflinePin(pin);
    onDone();
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <form onSubmit={handleSave} className="w-full max-w-sm bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <h1 className="text-lg font-black uppercase tracking-widest">
          Criar PIN Offline
        </h1>

        {error && <div className="text-red-400 text-xs font-bold">{error}</div>}

        <input
          type="password"
          inputMode="numeric"
          placeholder="PIN (4–8 dígitos)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-3 outline-none"
        />

        <input
          type="password"
          inputMode="numeric"
          placeholder="Confirmar PIN"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-3 outline-none"
        />

        <button className="w-full bg-white text-black font-black py-3 rounded-xl">
          Salvar PIN
        </button>
      </form>
    </div>
  );
}
