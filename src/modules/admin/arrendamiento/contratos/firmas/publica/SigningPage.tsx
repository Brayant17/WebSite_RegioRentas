import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { signerCharacterLabel, signerRoleLabel } from "../signerLabels";
import { PdfViewer } from "./PdfViewer";
import { SignaturePad } from "./SignaturePad";
import { acceptConsent, fetchDocument, openSession, readInvitationToken, requestCode, SignerRequestError, submitSignature, type CodeIssued, type SignerSessionView, type SignResult } from "./signer.client";

type Stage = "loading" | "unavailable" | "review" | "draw" | "code" | "done";
type Signed = Extract<SignResult, { resultado: "FIRMADO" }>;

const RESEND_SECONDS = 60;
const localTime = (iso: string) => new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Monterrey" }).format(new Date(iso));
const messageOf = (cause: unknown) => (cause instanceof Error ? cause.message : "No se pudo completar la operación. Vuelve a intentarlo.");

function Shell({ children, step }: { children: ReactNode; step?: string }) {
  return <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-8">
    <header className="space-y-1">
      <p className="text-sm font-semibold text-gray-600">Regio Rentas</p>
      <h1 className="text-2xl font-bold">Firma de contrato</h1>
      {step && <p className="text-sm text-gray-600">{step}</p>}
    </header>
    {children}
  </main>;
}

const ErrorNote = ({ message }: { message: string | null }) => (message ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{message}</p> : null);

// El texto del consentimiento, fijado en 07, menciona el envío al correo: aquí se aclara lo que realmente ocurre en este entorno.
function CodeChannelNotice({ session }: { session: SignerSessionView }) {
  return session.codigoDisponible
    ? <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Entorno de desarrollo: no se envía ningún correo. El código de verificación aparece en la terminal donde corre el servidor.</p>
    : <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">La verificación por código no está disponible en este entorno, así que todavía no se puede completar la firma.</p>;
}

function Unavailable() {
  return <Shell>
    <h2 className="text-lg font-semibold">Este enlace ya no está disponible</h2>
    <p>Pudo haber vencido, haber sido reemplazado por uno nuevo o ya haberse usado. Si ya firmaste, no necesitas hacer nada más. Si no, pide una invitación nueva a quien te la envió.</p>
  </Shell>;
}

function Review({ token, session, onContinue, onUnavailable }: { token: string; session: SignerSessionView; onContinue: () => void; onUnavailable: (cause: unknown) => boolean }) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [rendered, setRendered] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchDocument(token, session.sha256Documento).then(value => { if (!cancelled) setBytes(value); })
      .catch(cause => { if (!cancelled && !onUnavailable(cause)) setError(messageOf(cause)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, session.sha256Documento, attempt]);
  async function accept() {
    setBusy(true); setError(null);
    try { await acceptConsent(token, session.sha256Documento, session.consentimientoVersion); onContinue(); }
    catch (cause) { if (!onUnavailable(cause)) setError(messageOf(cause)); }
    finally { setBusy(false); }
  }
  return <Shell step="Paso 1 de 3: revisa el documento y tu consentimiento">
    <p className="text-sm">Firmas como <strong>{session.nombreFirmante}</strong> ({[signerRoleLabel(session.rol), signerCharacterLabel(session.caracter)].filter(Boolean).join(", ")}){session.nombreEntidad !== session.nombreFirmante ? ` en representación de ${session.nombreEntidad}` : ""}. Contrato: <strong>{session.folio ?? "sin folio"}</strong>. El enlace vence el {localTime(session.expiraAt)}.</p>
    {bytes ? <PdfViewer bytes={bytes} onRendered={() => setRendered(true)} onFailed={() => setRendered(false)} onReachedEnd={() => setReachedEnd(true)} /> : !error && <p role="status" className="text-sm">Cargando el documento…</p>}
    <ErrorNote message={error} />
    {error && !bytes && <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Volver a cargar el documento</Button>}
    {bytes && <p className="break-all text-xs text-gray-600">Huella SHA-256 del documento: {session.sha256Documento}</p>}
    <CodeChannelNotice session={session} />
    <section className="space-y-3 rounded-md border bg-white p-4" aria-labelledby="consent-title">
      <h2 id="consent-title" className="font-semibold">Consentimiento</h2>
      <p data-testid="consent-text" className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{session.consentimientoTexto}</p>
      {session.consentido
        ? <p className="text-sm font-medium">Ya aceptaste este texto.</p>
        : <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="acepta" className="mt-1" checked={accepted} disabled={!reachedEnd} onChange={event => setAccepted(event.target.checked)} /><span>He leído el documento y este consentimiento, y los acepto.</span></label>}
      {!session.consentido && !reachedEnd && rendered && <p className="text-xs text-gray-600">Desplázate hasta el final del documento para habilitar la casilla.</p>}
      {session.consentido
        ? <Button disabled={!rendered} onClick={onContinue}>Continuar</Button>
        : <Button disabled={!reachedEnd || !accepted || busy} onClick={() => void accept()}>{busy ? "Guardando…" : "Aceptar y continuar"}</Button>}
    </section>
  </Shell>;
}

function Draw({ notice, onBack, onContinue }: { notice: string | null; onBack: () => void; onContinue: (png: string) => void }) {
  const [png, setPng] = useState<string | null>(null);
  return <Shell step="Paso 2 de 3: dibuja tu firma">
    <ErrorNote message={notice} />
    <p className="text-sm">Dibuja tu firma dentro del recuadro con el dedo, un lápiz o el ratón.</p>
    <SignaturePad onChange={setPng} />
    <div className="flex flex-wrap gap-2">
      <Button disabled={!png} onClick={() => png && onContinue(png)}>Continuar</Button>
      <Button variant="outline" onClick={onBack}>Volver al documento</Button>
    </div>
  </Shell>;
}

function Code({ token, session, png, codeAlreadySent, onSent, onRedraw, onSigned, onUnavailable }: {
  token: string; session: SignerSessionView; png: string; codeAlreadySent: boolean; onSent: () => void; onRedraw: (notice: string | null) => void; onSigned: (result: Signed) => void; onUnavailable: (cause: unknown) => boolean;
}) {
  const [sent, setSent] = useState<CodeIssued | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const haveCode = codeAlreadySent || sent !== null;

  async function send() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try {
      setSent(await requestCode(token)); setCode(""); setCooldown(RESEND_SECONDS); onSent();
    } catch (cause) {
      if (onUnavailable(cause)) return;
      if (cause instanceof SignerRequestError && cause.code === "OTP_TOO_SOON") setCooldown(RESEND_SECONDS);
      setError(messageOf(cause));
    } finally { locked.current = false; setBusy(false); }
  }

  async function sign() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try {
      const result = await submitSignature(token, { codigo: code, sha256Documento: session.sha256Documento, firmaPng: png });
      if (result.resultado === "FIRMADO") return onSigned(result);
      setCode("");
      if (result.resultado === "OTP_INCORRECTO") setError(`El código no es correcto. ${result.intentosRestantes === 1 ? "Te queda 1 intento" : `Te quedan ${result.intentosRestantes} intentos`}.`);
      else if (result.resultado === "OTP_VENCIDO") setError("El código venció. Pide uno nuevo.");
      else if (result.resultado === "OTP_AGOTADO") setError("Se agotaron los intentos de este código. Pide uno nuevo.");
      else setError("Este código ya no es válido. Pide uno nuevo.");
    } catch (cause) {
      if (onUnavailable(cause)) return;
      // El dibujo se rechaza antes de gastar un intento: el código sigue sirviendo con otra firma.
      if (cause instanceof SignerRequestError && cause.code.startsWith("DRAWN_SIGNATURE")) return onRedraw(cause.message);
      setError(messageOf(cause));
    } finally { locked.current = false; setBusy(false); }
  }

  return <Shell step="Paso 3 de 3: confirma con tu código de verificación">
    <div className="space-y-1">
      <p className="text-sm font-medium">Tu firma:</p>
      <img src={`data:image/png;base64,${png}`} alt="Vista previa de tu firma dibujada" className="w-full max-w-sm rounded-md border bg-white" />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onRedraw(null)}>Dibujarla de nuevo</Button>
    </div>
    <CodeChannelNotice session={session} />
    <ErrorNote message={error} />
    {!session.codigoDisponible ? null : !haveCode
      ? <div className="space-y-2">
          <p className="text-sm">Para firmar necesitas un código de un solo uso.</p>
          <Button disabled={busy} onClick={() => void send()}>{busy ? "Generando…" : "Generar código"}</Button>
        </div>
      : <div className="space-y-3 rounded-md border bg-white p-4">
          {sent
            ? <p role="status" className="text-sm">Código generado. Vence a las {new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: "America/Monterrey" }).format(new Date(sent.expiraAt))} (hora de Monterrey). {sent.codigosRestantes > 0 ? `Puedes pedir ${sent.codigosRestantes} más.` : "Es el último código de este enlace."}</p>
            : <p className="text-sm">Ya se generó un código para esta invitación. Si no lo tienes, pide otro.</p>}
          <label className="block space-y-1 text-sm">
            <span>Código de 6 dígitos</span>
            <input name="codigo" className="block w-40 rounded-md border p-2 text-lg tracking-widest" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy}
              onChange={event => setCode(event.target.value.replace(/\D/g, ""))} />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirmacion" className="mt-1" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />
            <span>Confirmo que el trazo mostrado es mi firma para este documento.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || code.length !== 6 || !confirmed} onClick={() => void sign()}>{busy ? "Firmando…" : "Firmar documento"}</Button>
            <Button variant="outline" disabled={busy || cooldown > 0} onClick={() => void send()}>{cooldown > 0 ? `Pedir otro código (${cooldown} s)` : "Pedir otro código"}</Button>
          </div>
        </div>}
  </Shell>;
}

function Done({ result }: { result: Signed }) {
  const status = result.finalizacion === "COMPLETADA" ? "Todas las partes firmaron y el contrato quedó firmado."
    : result.finalizacion === "PENDIENTE" ? "Todas las partes firmaron. El documento final se está generando; no necesitas hacer nada más."
    : `${result.firmantesPendientes === 1 ? "Falta 1 firma" : `Faltan ${result.firmantesPendientes} firmas`} de otras partes. El contrato quedará firmado cuando todas firmen.`;
  return <Shell>
    <section role="status" className="space-y-2 rounded-md border border-green-300 bg-green-50 p-4">
      <h2 className="text-lg font-semibold">Tu firma quedó registrada</h2>
      <p className="text-sm">{status}</p>
      <p className="text-sm">Fecha: {localTime(result.firmadoAt)} (hora de Monterrey).</p>
    </section>
    <dl className="space-y-1 break-all text-xs text-gray-600">
      <div><dt className="inline font-medium">Huella del documento: </dt><dd className="inline">{result.sha256Documento}</dd></div>
      <div><dt className="inline font-medium">Huella de tu firma: </dt><dd className="inline">{result.sha256Firma}</dd></div>
      <div><dt className="inline font-medium">Huella de la evidencia: </dt><dd className="inline">{result.sha256Evidencia}</dd></div>
    </dl>
    <p className="text-sm">Este enlace ya no volverá a abrirse. Guarda esta información si la necesitas.</p>
  </Shell>;
}

export default function SigningPage() {
  const [token] = useState(() => readInvitationToken());
  const [stage, setStage] = useState<Stage>(token ? "loading" : "unavailable");
  const [session, setSession] = useState<SignerSessionView | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [png, setPng] = useState<string | null>(null);
  const [drawNotice, setDrawNotice] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [result, setResult] = useState<Signed | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Abrir requiere esta petición del navegador: un escáner de enlaces de correo no deja un evento de apertura.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setFailure(null);
    openSession(token).then(value => { if (cancelled) return; setSession(value); setCodeSent(value.otpExpiraAt !== null); setStage("review"); })
      .catch(cause => { if (cancelled) return; if (!leaveIfInvalid(cause)) setFailure(messageOf(cause)); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, attempt]);

  function leaveIfInvalid(cause: unknown): boolean {
    if (!(cause instanceof SignerRequestError) || cause.code !== "INVITATION_INVALID") return false;
    setStage("unavailable");
    return true;
  }

  if (stage === "unavailable" || !token) return <Unavailable />;
  if (stage === "done" && result) return <Done result={result} />;
  if (!session) return <Shell>
    {failure ? <><ErrorNote message={failure} /><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Reintentar</Button></> : <p role="status" className="text-sm">Abriendo tu invitación…</p>}
  </Shell>;
  if (stage === "draw" || (stage === "code" && !png)) return <Draw notice={drawNotice} onBack={() => setStage("review")} onContinue={value => { setPng(value); setDrawNotice(null); setStage("code"); }} />;
  if (stage === "code" && png) return <Code token={token} session={session} png={png} codeAlreadySent={codeSent} onSent={() => setCodeSent(true)} onUnavailable={leaveIfInvalid}
    onRedraw={notice => { setPng(null); setDrawNotice(notice); setStage("draw"); }} onSigned={value => { setResult(value); setStage("done"); }} />;
  return <Review token={token} session={session} onUnavailable={leaveIfInvalid} onContinue={() => { setSession({ ...session, consentido: true }); setStage("draw"); }} />;
}
