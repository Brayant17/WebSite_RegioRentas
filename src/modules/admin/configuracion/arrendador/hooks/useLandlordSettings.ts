import { useCallback, useEffect, useRef, useState } from "react";
import { landlordErrorMessage, landlordFormValues, loadLandlordSettings, saveLandlordSettings } from "../services/arrendador.service";
import type { LandlordFormValues, LandlordSettings } from "../types";

export function useLandlordSettings() {
  const [data, setData] = useState<LandlordSettings | null>(null);
  const [values, setValues] = useState<LandlordFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const reload = useCallback(() => {
    if (!busy.current) setRevision(previous => previous + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setData(null);
    setValues(null);
    loadLandlordSettings().then(settings => {
      if (!cancelled) {
        setData(settings);
        setValues(landlordFormValues(settings));
      }
    }).catch((err: unknown) => {
      if (!cancelled) setError(landlordErrorMessage(err));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

  function change(field: keyof LandlordFormValues, value: string) {
    if (busy.current) return;
    setValues(previous => previous ? { ...previous, [field]: value } : previous);
    setSuccess(null);
  }

  async function save() {
    if (busy.current || loading || !data || !values) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await saveLandlordSettings(data, values);
      if (!mounted.current) return;
      setData(updated);
      setValues(landlordFormValues(updated));
      setSuccess(updated.representative ? "Los cambios se guardaron correctamente." : "Los datos de la persona moral se guardaron correctamente. No hay representante principal configurado.");
    } catch (err) {
      if (mounted.current) setError(landlordErrorMessage(err));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return { data, values, loading, saving, error, success, change, save, reload };
}
