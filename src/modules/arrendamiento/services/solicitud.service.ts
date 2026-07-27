// solicitud.service.ts
import { SolicitudRepository } from "@/modules/arrendamiento/repositories/solicitud.repository"
import { uploadDocumentRepository } from "@/modules/arrendamiento/repositories/document.repository";
import type { RentalApplication, Documents } from "../types/rental";
import { toCreateApplicationDTO } from "../mappers/application.mapper";

const DOCUMENTS_UPLOAD_MAP: Array<{ storageKey: string; field: keyof Documents }> = [
    { storageKey: "identificacion_oficial", field: "officialId" },
    { storageKey: "comprobante_domicilio", field: "proofOfAddress" },
    { storageKey: "comprobante_ingresos", field: "proofOfIncome" },
    { storageKey: "constancia_situacion_fiscal", field: "taxCertificate" },
    { storageKey: "estados_cuenta", field: "bankStatements" },
    { storageKey: "identificacion_oficial_fiador", field: "guarantorOfficialId" },
    { storageKey: "comprobante_domicilio_fiador", field: "guarantorProofOfAddress" },
];

async function uploadApplicationDocuments(
    personaId: string,
    documents: Documents,
) {
    const formData = new FormData();

    formData.append("personaId", personaId);

    for (const documentConfig of DOCUMENTS_UPLOAD_MAP) {
        const file = documents[documentConfig.field];

        if (!file) {
            continue;
        }

        formData.append(
            documentConfig.field,
            file
        );
    }

    await uploadDocumentRepository(formData);
}

export async function saveSolicitud(application: RentalApplication) {
    const repository = new SolicitudRepository();

    const date = new Date(application.ocupationDate);

    const dateToDateBD = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    const applicationCopy = {
        ...application,
        ocupationDate: dateToDateBD,
    };

    const dtoSolicitud = toCreateApplicationDTO(applicationCopy);
    const response = await repository.createApplication(dtoSolicitud);

    if (!response?.id) {
        throw new Error("La solicitud se guardó sin un identificador válido.");
    }

    const personaId = response.persona_id;

    if (!personaId) {
        throw new Error("No se recibió el identificador de la persona para registrar los documentos.");
    }

    await uploadApplicationDocuments(personaId, application.documents);

    return response;
}