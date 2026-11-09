import { useCallback, useEffect, useRef, useState } from "react";
import { getLatestSignatureProcess } from "../repositories/firmas.repository";
import { cancelSignatureProcess, listSignatureInvitations } from "../services/firma.client";
import type { SignatureInvitationState, SignatureProcess } from "../types";

export function useSignatureProcess(contractId: string) {
  const [data, setData] = useState<SignatureProcess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    getLatestSignatureProcess(contractId).then(value => { if (!cancelled) setData(value); })
      .catch(() => { if (!cancelled) setError("No se pudo consultar el proceso de firma. Verifica tu sesión de administrador y vuelve a intentarlo."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contractId, revision]);
  return { data, loading, error, reload };
}

// processId null: el proceso no está pendiente y no hay invitaciones que administrar.
export function useSignatureInvitations(contractId: string, processId: string | null) {
  const [data, setData] = useState<SignatureInvitationState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!processId) return;
    let cancelled = false;
    setError(null);
    listSignatureInvitations(contractId, processId).then(value => { if (!cancelled) setData(value); })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudo consultar el estado de las invitaciones."); });
    return () => { cancelled = true; };
  }, [contractId, processId, revision]);
  return { data, error, reload };
}

export function useCancelSignature(contractId: string, processId: string, onCancelled?: () => void) {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cancel(reason: string) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try {
      await cancelSignatureProcess(contractId, processId, reason);
      onCancelled?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cancelar el proceso de firma.");
    } finally { locked.current = false; setBusy(false); }
  }
  return { busy, error, cancel };
}
