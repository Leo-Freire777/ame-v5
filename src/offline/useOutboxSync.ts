import { useEffect } from "react";
import { flushOutbox } from "./safeWrite";

export function useOutboxSync() {
  useEffect(() => {
    let running = false;

    const run = async () => {
      if (running) return;
      running = true;
      try {
        await flushOutbox(50);
      } finally {
        running = false;
      }
    };

    // roda quando abre o app
    run();

    // roda quando volta internet
    window.addEventListener("online", run);

    return () => {
      window.removeEventListener("online", run);
    };
  }, []);
}