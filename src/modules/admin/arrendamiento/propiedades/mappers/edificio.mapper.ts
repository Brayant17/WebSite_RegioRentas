import type { CreateEdificioDto } from "../dtos/create-edifico-dto";
import type { EdificioForm } from "../schemas/edificio.schema";

export function toCreateEdificioDto(edificio: EdificioForm): CreateEdificioDto{
    return {
        type: edificio.tipo,
        nombre: edificio.nombre,
        direccion: edificio.direccion,
        ciudad: edificio.ciudad,
        estado: edificio.estado,
        codigo_postal: edificio.codigo_postal,
        estatus: edificio.estatus
    }
}