import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LandlordSelector } from "./LandlordSelector";
import { resolveLandlord, validateLandlord, type LandlordSelection, type PartyReference } from "./model";
import { replaceDraftLandlord } from "./partes.repository";
import { contractErrorMessage } from "../services/contratos.service";

export function DraftLandlordEditor({ contractId, parts, onSaved }: { contractId: string; parts: PartyReference[]; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState<LandlordSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  function start() {
    try { setSelection(resolveLandlord(parts)); setError(null); setEditing(true); }
    catch (cause) { setError(contractErrorMessage(cause)); }
  }
  async function save() {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(null);
    try { await replaceDraftLandlord(contractId, validateLandlord(selection)); setEditing(false); onSaved(); }
    catch (cause) { setError(contractErrorMessage(cause)); }
    finally { busy.current = false; setSaving(false); }
  }
  return <section className="space-y-3">
    {editing ? <>
      <LandlordSelector value={selection} onChange={setSelection} disabled={saving} />
      <p className="text-sm text-muted-foreground">El cambio afecta solo futuras generaciones. Los documentos y PDFs históricos conservarán su arrendador.</p>
      <div className="flex gap-2"><Button disabled={saving || !selection} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar arrendador"}</Button>
        <Button variant="outline" disabled={saving} onClick={() => setEditing(false)}>Cancelar</Button></div>
    </> : <Button variant="outline" onClick={start}>Cambiar arrendador del borrador</Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
