import { useEffect, useRef, useState } from "react";
import { documentErrorMessage, generateContractDocument } from "../services/documentos.service";

export function useDocumentGeneration(contractId: string) {
  const busy = useRef(false);
  const mounted = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof generateContractDocument>> | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function generate(versionId: string) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const generated = await generateContractDocument(contractId, versionId);
      if (mounted.current) setResult(generated);
      return generated;
    } catch (err) {
      if (mounted.current) setError(documentErrorMessage(err));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return { saving, error, result, generate };
}
