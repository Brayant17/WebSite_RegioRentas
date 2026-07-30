import type { UpdateEdificioDTO } from "../dtos/update-edificio-dto";
import type { EdificioForm } from "../schemas/edificio.schema";

export function toUpdateEdificioDto(id: string, form: EdificioForm): UpdateEdificioDTO {
    return {
        id,
        type: form.tipo,
        nombre: form.nombre,
        direccion: form.direccion,
        ciudad: form.ciudad,
        estado: form.estado,
        codigo_postal: form.codigo_postal,
        estatus: form.estatus,
    };
}