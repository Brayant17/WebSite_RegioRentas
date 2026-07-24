// solicitud.service.ts
import { SolicitudRepository } from "@/modules/arrendamiento/repositories/solicitud.repository"
import type { RentalApplication } from "../types/rental";
import { toCreateApplicationDTO } from "../mappers/application.mapper";

export async function saveSolicitud(application: RentalApplication) {
    const repository = new SolicitudRepository

    const date = new Date(application.ocupationDate);

    const dateToDateBD = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    const applicationCopy = {
        ...application,
        ocupationDate: dateToDateBD,
    };

    const dtoSolicitud = toCreateApplicationDTO(applicationCopy);
    const response = await repository.createApplication(dtoSolicitud);
    console.log(response);
    // aqui ira el intento de subir los archivos, verificar que no vengan vacios con ZOD si es posible
    return response

}