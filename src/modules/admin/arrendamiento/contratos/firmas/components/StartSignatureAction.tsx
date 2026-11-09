import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { representativeCharacters } from "@/modules/admin/configuracion/arrendador/types";
import { useStartSignature } from "../hooks/useStartSignature";
import { reviewRepresentation } from "../representationReview";
import { getContractRepresentation, type ContractRepresentation } from "../repositories/firmas.repository";

const LANDLORD_SETTINGS_PATH = "/admin/configuracion/arrendador";
const personName = (person: ContractRepresentation["representatives"][number]["persona"]) => person ? [person.nombre, person.apellido_paterno, person.apellido_materno].filter(Boolean).join(" ") : "";

function RepresentationItem({ entry }: { entry: ContractRepresentation }) {
  const review = reviewRepresentation({ company: entry.company, role: entry.role, representatives: entry.representatives, catalog: representativeCharacters });
  return <li className="space-y-1 rounded-md bg-muted/50 p-2">
    <p><strong>{entry.company}</strong>{entry.representatives.length === 1 ? ` · Representante: ${personName(entry.representatives[0].persona) || "sin nombre"}` : ""}</p>
    {review.quality && <p>El firmante verá: «{review.quality}».</p>}
    {review.message && <p role={review.status === "blocking" ? "alert" : "status"} className={review.status === "blocking" ? "text-destructive" : "font-medium"}>{review.message}</p>}
    {review.status !== "ok" && (entry.isConfiguredLandlord
      ? <p><a className="underline" href={LANDLORD_SETTINGS_PATH}>Revisar los datos del representante</a>. Si cambias algo, genera una revisión nueva del documento antes de iniciar.</p>
      : <p>Esta persona moral no es el arrendador configurado, así que no se puede corregir desde Datos del arrendador.</p>)}
  </li>;
}

export function StartSignatureAction({ contractId, documentId, onStarted }: { contractId: string; documentId: string; onStarted?: () => void }) {
  const signature = useStartSignature(contractId, documentId, onStarted);
  const [confirming, setConfirming] = useState(false);
  const [representation, setRepresentation] = useState<ContractRepresentation[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const load = useCallback(() => {
    setLoadError(false); setRepresentation(null);
    getContractRepresentation(contractId).then(setRepresentation).catch(() => setLoadError(true));
  }, [contractId]);
  useEffect(() => { if (confirming) load(); }, [confirming, load]);
  if (!confirming) return <Button size="sm" onClick={() => setConfirming(true)}>Iniciar firma</Button>;
  const blocked = !representation || representation.some(entry => reviewRepresentation({ company: entry.company, role: entry.role, representatives: entry.representatives, catalog: representativeCharacters }).status === "blocking");
  return <div className="space-y-2 rounded-md border p-3">
    <p className="text-sm">Se verificará el PDF y el contrato pasará a PENDIENTE FIRMA. Sus condiciones y partes quedarán congeladas hasta completar o cancelar el proceso.</p>
    {loadError && <div className="space-y-1"><p role="alert" className="text-sm text-destructive">No se pudieron consultar los datos de representación.</p><Button size="sm" variant="outline" onClick={load}>Volver a consultar</Button></div>}
    {!loadError && !representation && <p role="status" className="text-sm">Consultando los datos de representación…</p>}
    {representation && representation.length > 0 && <div className="space-y-1 text-sm">
      <p className="font-medium">Revisa los datos de representación antes de iniciar:</p>
      <ul aria-label="Datos de representación" className="space-y-2">{representation.map(entry => <RepresentationItem key={`${entry.role}-${entry.companyId}`} entry={entry} />)}</ul>
    </div>}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={signature.busy || blocked} onClick={() => void signature.start()}>{signature.busy ? "Verificando…" : "Confirmar inicio de firma"}</Button>
      <Button size="sm" variant="outline" disabled={signature.busy} onClick={() => setConfirming(false)}>Cancelar</Button>
    </div>
    {signature.error && <p role="alert" className="text-sm text-destructive">{signature.error}</p>}
  </div>;
}
