"use client";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Phone,
    Calendar,
    Fingerprint,
    Users,
    FileText,
    ImageOff,
    Home,
} from "lucide-react";
import { getApplication } from "../services/solicitudes.service";
import type { SolicitudArrendamiento } from "@/modules/admin/arrendamiento/types/Solicitud.type";
import type { ApplicationDetail, DocumentoPersonal } from "@/modules/admin/arrendamiento/types/database.type";
import { DataItem } from "./DataItem"
import { EmptyState } from "./EmptyState"
import { LightboxUrl } from "./LightboxUrl";

type TabValue = "general" | "laboral" | "fiador" | "referencias" | "documentos";

// Helpers

function display(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === "") return "Sin dato";
    return String(value);
}

function fullName(...parts: (string | null | undefined)[]): string {
    const clean = parts.filter(Boolean);
    return clean.length > 0 ? clean.join(" ") : "Sin dato";
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function statusBadge(status: string) {
    const normalized = (status || "").toLowerCase();
    if (normalized === "aprobada") {
        return {
            label: "Aprobada",
            className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300",
        };
    }
    if (normalized === "rechazada") {
        return {
            label: "Rechazada",
            className: "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300",
        };
    }
    return {
        label: "Pendiente",
        className: "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300",
    };
}

function getDocUrl(doc: DocumentoPersonal): string {
    return typeof doc === "string" ? doc : doc.url ?? "";
}

function getDocLabel(doc: DocumentoPersonal, index: number): string {
    if (typeof doc === "string") return `Documento ${index + 1}`;
    return doc.nombre_archivo ?? doc.tipo_documento ?? `Documento ${index + 1}`;
}

function isImageDoc(url: string): boolean {
    return /\.(png|jpe?g|gif|webp|svg)$/i.test(url);
}

// Componente
export default function RequestDetailsModal({
    open,
    solicitud,
    onClose,
    onUpdateStatus,
}: {
    open: boolean;
    solicitud?: SolicitudArrendamiento | null;
    onClose: () => void;
    onUpdateStatus: (id: string, newStatus: "aprobada" | "rechazada" | "pendiente") => void;
}) {
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);
    const [application, setApplication] = useState<ApplicationDetail | null>(null);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabValue>("general");

    const solicitudId = solicitud?.id;

    useEffect(() => {
        if (!open || !solicitudId) {
            setApplication(null);
            setDetailsError(null);
            return;
        }

        let cancelled = false;

        const fetchDetails = async () => {
            try {
                setLoadingDetails(true);
                setDetailsError(null);
                const data = await getApplication(solicitudId);
                if (cancelled) return;
                const record = Array.isArray(data) ? data[0] : data;
                setApplication(record ?? null);
            } catch (err) {
                console.error("[RequestDetailsModal] error al cargar detalles:", err);
                if (!cancelled) setDetailsError("No se pudieron cargar los detalles de la solicitud");
            } finally {
                if (!cancelled) setLoadingDetails(false);
            }
        };

        fetchDetails();
        return () => {
            cancelled = true;
        };
        // Dependemos del ID, NO del objeto `solicitud` completo, para que el
        // efecto no se reinicie en cada render si el padre recrea el objeto.
    }, [open, solicitudId]);

    // Reinicia el lightbox y la pestaña activa al cerrar o cambiar de solicitud
    useEffect(() => {
        if (!open) setLightboxUrl(null);
        setActiveTab("general");
    }, [open, solicitudId]);

    const referencias = application?.referencias_personales ?? [];
    const documentos = application?.documentos_personales ?? [];
    const tieneFiador = Boolean(
        application?.fiador_nombre || application?.fiador_apellido_paterno || application?.fiador_telefono
    );
    const tieneSituacionLaboral = Boolean(
        application?.situacion_laboral || application?.empresa || application?.puesto
    );

    const solicitanteFullName = useMemo(() => (solicitud ? solicitud.applicantName : ""), [solicitud]);

    if (!solicitud) return null;

    const handleApprove = () => onUpdateStatus(solicitud.id, "aprobada");
    const handleReject = () => onUpdateStatus(solicitud.id, "rechazada");

    const badge = statusBadge(solicitud.status);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogTitle className="sr-only">
                    Detalles de la solicitud {solicitud.folio} de {solicitanteFullName}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    Información completa del solicitante, situación laboral, fiador, referencias y documentos adjuntos.
                </DialogDescription>
                {/* Encabezado con identidad del solicitante                          */}
                <div className="flex items-start gap-4 border-b bg-muted/30 px-6 py-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
                        {initials(solicitanteFullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-lg font-semibold">{solicitanteFullName}</h2>
                            <Badge className={badge.className}>{badge.label}</Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{solicitud.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 font-mono">
                                <Fingerprint className="h-3.5 w-3.5" />
                                {solicitud.folio}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Home className="h-3.5 w-3.5" />
                                {solicitud.property} · {solicitud.unit}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {new Date(solicitud.date).toLocaleDateString("es-MX", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ---------------------------------------------------------------- */}
                {/* Pestañas (Tabs nativo del proyecto, variant="line")               */}
                {/* ---------------------------------------------------------------- */}
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {loadingDetails && (
                        <div className="grid gap-4 px-6 py-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
                            ))}
                        </div>
                    )}

                    {detailsError && !loadingDetails && (
                        <p className="px-6 py-6 text-sm text-destructive">{detailsError}</p>
                    )}

                    {!loadingDetails && !detailsError && !application && (
                        <div className="px-6 py-10 text-center">
                            <p className="text-sm text-muted-foreground">
                                No se encontró información detallada para esta solicitud.
                            </p>
                        </div>
                    )}

                    {application && !loadingDetails && (
                        <Tabs
                            value={activeTab}
                            onValueChange={(v) => setActiveTab(v as TabValue)}
                            className="w-full"
                        >
                            <div className="px-6">
                                <TabsList variant="line">
                                    <TabsTrigger value="general">General</TabsTrigger>
                                    {tieneSituacionLaboral && <TabsTrigger value="laboral">Laboral</TabsTrigger>}
                                    {tieneFiador && <TabsTrigger value="fiador">Fiador</TabsTrigger>}
                                    <TabsTrigger value="referencias">
                                        Referencias
                                        {referencias.length > 0 && (
                                            <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                                                {referencias.length}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                    <TabsTrigger value="documentos">
                                        Documentos
                                        {documentos.length > 0 && (
                                            <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                                                {documentos.length}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="general">
                                <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-6 py-6 sm:grid-cols-2">
                                    <DataItem label="Teléfono" value={display(application.solicitante_telefono)} />
                                    <DataItem label="Correo" value={display(application.solicitante_correo)} />
                                    <DataItem label="CURP" value={display(application.solicitante_curp)} />
                                    <DataItem label="RFC" value={display(application.solicitante_rfc)} />
                                    <DataItem label="Sexo" value={display(application.solicitante_sexo)} />
                                    <DataItem label="Estado civil" value={display(application.solicitante_estado_civil)} />
                                    <DataItem
                                        label="Fecha estimada de ocupación"
                                        value={
                                            application.fecha_estimada_ocupacion
                                                ? new Date(application.fecha_estimada_ocupacion).toLocaleDateString("es-MX")
                                                : "Sin dato"
                                        }
                                    />
                                    <DataItem label="Tipo de inmueble" value={display(solicitud.propertyType)} />
                                    <DataItem
                                        wide
                                        label="Domicilio de origen"
                                        value={display(application.solicitante_domicilio_origen)}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="laboral">
                                <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-6 py-6 sm:grid-cols-2">
                                    <DataItem label="Situación laboral" value={display(application.situacion_laboral)} />
                                    <DataItem label="Empresa" value={display(application.empresa)} />
                                    <DataItem label="Puesto" value={display(application.puesto)} />
                                    <DataItem
                                        label="Ingreso mensual"
                                        value={
                                            application.ingreso_mensual !== null && application.ingreso_mensual !== undefined
                                                ? `$${Number(application.ingreso_mensual).toLocaleString("es-MX")}`
                                                : "Sin dato"
                                        }
                                    />
                                    <DataItem label="Jefe inmediato" value={display(application.jefe_inmediato)} />
                                    <DataItem label="Teléfono de la empresa" value={display(application.telefono_empresa)} />
                                    <DataItem label="Antigüedad" value={display(application.antiguedad)} />
                                </div>
                            </TabsContent>

                            <TabsContent value="fiador">
                                <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-6 py-6 sm:grid-cols-2">
                                    <DataItem
                                        label="Nombre completo"
                                        value={fullName(
                                            application.fiador_nombre,
                                            application.fiador_apellido_paterno,
                                            application.fiador_apellido_materno
                                        )}
                                    />
                                    <DataItem label="Parentesco" value={display(application.fiador_parentesco)} />
                                    <DataItem label="Teléfono" value={display(application.fiador_telefono)} />
                                    <DataItem label="Correo" value={display(application.fiador_correo)} />
                                </div>
                            </TabsContent>

                            <TabsContent value="referencias">
                                <div className="px-6 py-6">
                                    {referencias.length === 0 ? (
                                        <EmptyState icon={Users} text="No hay referencias personales registradas" />
                                    ) : (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {referencias.map((ref, idx) => (
                                                <div key={idx} className="rounded-lg border p-3">
                                                    <p className="text-sm font-semibold">{display(ref.nombre)}</p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">{display(ref.parentesco)}</p>
                                                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm">
                                                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                                        {display(ref.telefono)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="documentos">
                                <div className="px-6 py-6">
                                    {documentos.length === 0 ? (
                                        <EmptyState icon={FileText} text="No hay documentos adjuntos" />
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                            {documentos.map((doc, idx) => {
                                                const url = getDocUrl(doc);
                                                const label = getDocLabel(doc, idx);
                                                const isImage = url && isImageDoc(url);
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => (isImage ? setLightboxUrl(url) : url && window.open(url, "_blank"))}
                                                        className="group overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md"
                                                        disabled={!url}
                                                    >
                                                        <div className="flex h-28 items-center justify-center overflow-hidden bg-muted">
                                                            {isImage ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                    src={url}
                                                                    alt={label}
                                                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                                                />
                                                            ) : url ? (
                                                                <FileText className="h-8 w-8 text-muted-foreground" />
                                                            ) : (
                                                                <ImageOff className="h-8 w-8 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        <p className="truncate px-2 py-1.5 text-xs font-medium">{label}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </div>

                {/* ---------------------------------------------------------------- */}
                {/* Acciones                                                           */}
                {/* ---------------------------------------------------------------- */}
                <div className="flex items-center justify-end gap-2 border-t bg-background px-6 py-4">
                    <Button variant="ghost" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button variant="destructive" onClick={handleReject}>
                        Rechazar
                    </Button>
                    <Button onClick={handleApprove}>Aprobar</Button>
                </div>

                {/* Lightbox de imagen                                                 */}
                {lightboxUrl && (
                    <LightboxUrl lightboxUrl={lightboxUrl} setLightboxUrl={setLightboxUrl} />
                )}
            </DialogContent>
        </Dialog>
    );
}