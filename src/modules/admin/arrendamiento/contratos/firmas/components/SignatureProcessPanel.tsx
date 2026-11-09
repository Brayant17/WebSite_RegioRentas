import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { documentGeneratedAt } from "../../documentos/components/DocumentShared";
import { useCancelSignature, useSignatureInvitations, useSignatureProcess } from "../hooks/useSignatureProcess";
import { createSignatureInvitation } from "../services/firma.client";
import type { SignatureInvitationState, SignatureProcess } from "../types";

const MAX_REASON = 1000;
const label = (value: string) => value.replaceAll("_", " ");

function CancelSignatureAction({ contractId, processId, onCancelled }: { contractId: string; processId: string; onCancelled: () => void }) {
  const cancellation = useCancelSignature(contractId, processId, onCancelled);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Cancelar proceso de firma</Button>;
  const valid = reason.trim().length > 0 && reason.trim().length <= MAX_REASON;
  return <div className="space-y-2 rounded-md border p-3">
    <label className="block space-y-1 text-sm">
      <span>Motivo de la cancelación</span>
      <textarea name="motivo_cancelacion" className="w-full rounded-md border p-2" maxLength={MAX_REASON} rows={3} value={reason} disabled={cancellation.busy}
        onChange={event => setReason(event.target.value)} />
    </label>
    <p className="text-sm text-muted-foreground">El contrato volverá a BORRADOR. El documento conserva su contenido y podrá reutilizarse con una nueva verificación.</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={!valid || cancellation.busy} onClick={() => void cancellation.cancel(reason.trim())}>{cancellation.busy ? "Cancelando…" : "Confirmar cancelación"}</Button>
      <Button size="sm" variant="outline" disabled={cancellation.busy} onClick={() => { setOpen(false); setReason(""); }}>Volver</Button>
    </div>
    {cancellation.error && <p role="alert" className="text-sm text-destructive">{cancellation.error}</p>}
  </div>;
}

function InvitationLink({ link }: { link: string }) {
  const [copy, setCopy] = useState<"copied" | "failed" | null>(null);
  // El portapapeles requiere HTTPS o localhost; si falla, el campo permite copiarlo a mano.
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopy("copied"); }
    catch { setCopy("failed"); }
  }
  return <div className="mt-1 space-y-1 rounded-md border p-2">
    <label className="block space-y-1">
      <span className="font-medium">Enlace privado</span>
      <input name="enlace_firma" readOnly className="w-full rounded-md border p-1 font-mono text-xs" value={link} onFocus={event => event.target.select()} />
    </label>
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => void copyLink()}>Copiar enlace</Button>
      {copy === "copied" && <span role="status" className="text-muted-foreground">Enlace copiado.</span>}
      {copy === "failed" && <span role="alert" className="text-destructive">No se pudo copiar. Selecciona el enlace y cópialo a mano.</span>}
    </div>
    <p className="text-muted-foreground">Compártelo solo con este firmante: da acceso al documento. No se envió ningún correo, y este enlace no se podrá volver a mostrar después de salir de esta página.</p>
  </div>;
}

const INVITATION_STATUS: Record<SignatureInvitationState["estado"], string> = { VIGENTE: "Invitación vigente", VENCIDA: "Invitación vencida", REVOCADA: "Invitación revocada", USADA: "Invitación usada" };

function InvitationAction({ contractId, processId, signerId, invitation, link, onIssued }: {
  contractId: string; processId: string; signerId: string; invitation: SignatureInvitationState | undefined; link: string | undefined; onIssued: (signerId: string, link: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLiveLink = Boolean(link) || invitation?.estado === "VIGENTE";
  async function issue() {
    setBusy(true); setError(null);
    try { onIssued(signerId, (await createSignatureInvitation(contractId, processId, signerId)).enlace); setConfirming(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo generar el enlace."); }
    finally { setBusy(false); }
  }
  return <div className="mt-1 space-y-1">
    {invitation && <p className="text-muted-foreground">{INVITATION_STATUS[invitation.estado]} · generada: {documentGeneratedAt(invitation.emitidaAt)} · vence: {documentGeneratedAt(invitation.expiraAt)}</p>}
    {link && <InvitationLink link={link} />}
    {!link && invitation?.estado === "VIGENTE" && <p className="text-muted-foreground">El enlace solo se muestra al generarlo, porque el sistema no lo guarda. Si ya no lo tienes, genera uno nuevo.</p>}
    {confirming
      ? <div className="flex flex-wrap items-center gap-2">
          <span>El enlace anterior dejará de funcionar y el firmante tendrá que repetir la revisión y el consentimiento.</span>
          <Button size="sm" disabled={busy} onClick={() => void issue()}>{busy ? "Generando…" : "Confirmar enlace nuevo"}</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Volver</Button>
        </div>
      : <Button size="sm" variant="outline" disabled={busy} onClick={() => hasLiveLink ? setConfirming(true) : void issue()}>{busy ? "Generando…" : hasLiveLink ? "Generar enlace nuevo" : "Generar enlace"}</Button>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}

function FinalPdfLinks({ contractId, processId }: { contractId: string; processId: string }) {
  const url = `/api/admin/arrendamiento/contratos/${encodeURIComponent(contractId)}/firmas/${encodeURIComponent(processId)}/pdf-final`;
  return <p className="flex flex-wrap gap-3 text-sm">
    <a className="underline" href={url} target="_blank" rel="noreferrer">Ver PDF final</a>
    <a className="underline" href={`${url}?descargar=1`}>Descargar PDF final</a>
  </p>;
}

function ProcessDetail({ process, contractId, invitations, invitationsError, links, onIssued, onCancelled, onRefresh, refreshing }: {
  process: SignatureProcess; contractId: string; invitations: SignatureInvitationState[]; invitationsError: string | null; links: Record<string, string>;
  onIssued: (signerId: string, link: string) => void; onCancelled: () => void; onRefresh: () => void; refreshing: boolean;
}) {
  const signers = [...process.firmantes].sort((a, b) => a.rol.localeCompare(b.rol));
  const pending = process.estado === "PENDIENTE";
  return <div className="space-y-3 rounded-lg border p-5">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm">Estado del proceso:</span>
      <Badge variant={pending ? "default" : "outline"}>{label(process.estado)}</Badge>
      {pending && <Button size="sm" variant="outline" disabled={refreshing} onClick={onRefresh}>{refreshing ? "Actualizando…" : "Actualizar estado"}</Button>}
    </div>
    <p className="text-sm">Iniciado: {documentGeneratedAt(process.iniciado_at)}{process.documento ? ` · Documento v${process.documento.numero_version} (${process.documento.nombre_archivo})` : ""}</p>
    {process.estado === "CANCELADO" && <p className="text-sm">Cancelado: {documentGeneratedAt(process.cancelado_at)} · Motivo: {process.motivo_cancelacion}</p>}
    {process.estado === "COMPLETADO" && <FinalPdfLinks contractId={contractId} processId={process.id} />}
    {pending && signers.length > 0 && signers.every(signer => signer.estado === "FIRMADO") && <p role="status" className="text-sm">Todas las partes firmaron, pero el PDF final aún no está registrado. La recuperación programada volverá a intentarlo.</p>}
    {pending && invitationsError && <p role="alert" className="text-sm text-destructive">{invitationsError}</p>}
    <ul className="space-y-2 text-sm" aria-label="Firmantes">
      {signers.map(signer => <li key={signer.id}>{label(signer.rol)}: {signer.nombre_entidad} ({label(signer.caracter)}) — {label(signer.estado)}{pending && signer.estado === "PENDIENTE" && <InvitationAction contractId={contractId} processId={process.id} signerId={signer.id} invitation={invitations.find(item => item.firmanteId === signer.id)} link={links[signer.id]} onIssued={onIssued} />}</li>)}
    </ul>
    {pending && <CancelSignatureAction contractId={contractId} processId={process.id} onCancelled={onCancelled} />}
  </div>;
}

// Muestra el proceso más reciente del contrato (pendiente o histórico). onChanged recarga la ficha y sus documentos.
export function SignatureProcessPanel({ contractId, onChanged }: { contractId: string; onChanged?: () => void }) {
  const { data, loading, error, reload } = useSignatureProcess(contractId);
  const invitations = useSignatureInvitations(contractId, data?.estado === "PENDIENTE" ? data.id : null);
  // Los enlaces viven solo en memoria y aquí, para sobrevivir a "Actualizar estado".
  const [links, setLinks] = useState<Record<string, string>>({});
  const previousStatus = useRef(data?.estado);
  useEffect(() => {
    // Al completarse, el contrato también cambió de estado y ya tiene documento final.
    if (previousStatus.current === "PENDIENTE" && data?.estado === "COMPLETADO") onChanged?.();
    previousStatus.current = data?.estado;
  }, [data?.estado, onChanged]);
  const cancelled = () => { reload(); onChanged?.(); };
  if (loading && !data) return <p role="status" className="text-sm">Cargando proceso de firma…</p>;
  if (error) return <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={reload}>Reintentar</Button></div>;
  if (!data) return null;
  return <section className="space-y-3" aria-labelledby="signature-process-title">
    <h2 id="signature-process-title" className="text-lg font-semibold">Proceso de firma</h2>
    <ProcessDetail process={data} contractId={contractId} invitations={invitations.data} invitationsError={invitations.error} links={links} refreshing={loading} onCancelled={cancelled}
      onRefresh={() => { reload(); invitations.reload(); }}
      onIssued={(signerId, link) => { setLinks(current => ({ ...current, [signerId]: link })); invitations.reload(); }} />
  </section>;
}
