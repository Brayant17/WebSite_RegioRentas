import type { Edificio } from "../../types/edificios.type";
import { getUnits, insertEdificio, updateEdificio } from "../repositories/propiedades.respository";
import type { EdificioForm } from "../schemas/edificio.schema";
import { toCreateEdificioDto } from "../mappers/edificio.mapper";
import { toUpdateEdificioDto } from "../mappers/updateEdificio.mapper";

export async function getUnitsByBuilding(idEdificio: string) {
    const unidades = await getUnits(idEdificio);
    return unidades;
}

export async function saveEdificio(edificio: EdificioForm): Promise<Edificio> {
    const dto = toCreateEdificioDto(edificio);
    return await insertEdificio(dto);
}

export async function editEdificio(id: string, form: EdificioForm): Promise<Edificio> {
    const dto = toUpdateEdificioDto(id, form);
    return await updateEdificio(dto);
}