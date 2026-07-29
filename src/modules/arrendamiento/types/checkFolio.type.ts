export type EstadoSolicitud = "aprobado" | "rechazado" | "pendiente";

export interface ResultadoConsulta {
    folio: string;
    estatus: EstadoSolicitud;
    unidad: string;
    edificio: string;
}