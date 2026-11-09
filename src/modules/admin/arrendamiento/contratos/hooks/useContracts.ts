import { useCallback, useEffect, useRef, useState } from "react";
import { contractErrorMessage, createContract, findApplicationContract, findContract, listContracts, loadContractCreation, saveDraft } from "../services/contratos.service";
import type { ContractFormValues } from "../types";
import type { LandlordSelection } from "../partes/model";

function useContractQuery<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    load().then(value => {
      if (!cancelled) setData(value);
    }).catch((err: unknown) => {
      if (!cancelled) setError(contractErrorMessage(err));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [load, revision]);
  return { data, loading, error, reload };
}

export function useContracts() {
  return useContractQuery(listContracts);
}

export function useContract(id: string) {
  return useContractQuery(useCallback(() => findContract(id), [id]));
}

export function useApplicationContract(id: string) {
  return useContractQuery(useCallback(() => findApplicationContract(id), [id]));
}

export function useContractCreation(id: string) {
  return useContractQuery(useCallback(() => loadContractCreation(id), [id]));
}

export function useContractRecovery(id: string) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function check() {
    setChecking(true);
    setError(null);
    try {
      const existing = await findApplicationContract(id);
      if (!existing) setError("No se encontró un contrato para esta solicitud. Puedes reintentar la creación.");
      return existing;
    } catch (err) {
      setError(contractErrorMessage(err));
    } finally { setChecking(false); }
  }
  return { checking, error, check };
}

export function useContractMutation() {
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      return await operation();
    } catch (err) {
      setError(contractErrorMessage(err));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return {
    saving, error,
    create: (id: string, values: ContractFormValues, landlord?: LandlordSelection) => run(() => createContract(id, values, landlord)),
    update: (id: string, values: ContractFormValues) => run(() => saveDraft(id, values)),
  };
}
