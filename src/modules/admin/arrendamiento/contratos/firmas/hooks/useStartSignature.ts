import { useRef, useState } from "react";
import { startSignatureProcess } from "../services/firma.client";

export function useStartSignature(contractId: string, documentId: string, onStarted?: () => void) {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try {
      await startSignatureProcess(contractId, documentId);
      onStarted?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar la firma.");
    } finally { locked.current = false; setBusy(false); }
  }
  return { busy, error, start };
}
