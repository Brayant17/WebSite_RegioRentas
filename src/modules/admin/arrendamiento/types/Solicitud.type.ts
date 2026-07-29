export type SolicitudArrendamiento = {
    id: string;
    folio: string;
    applicantName: string;
    email: string;
    property: string;
    unit: string;
    propertyType: string;
    status: "pendiente" | "aprobada" | "rechazada";
    date: string;
};