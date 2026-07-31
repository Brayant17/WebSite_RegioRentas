import type { Edificio } from "../../types/edificios.type";
import { getUnits, insertEdificio, updateEdificio } from "../repositories/propiedades.respository";
import type { EdificioForm } from "../schemas/edificio.schema";
import { toCreateEdificioDto } from "../mappers/edificio.mapper";
import { toUpdateEdificioDto } from "../mappers/updateEdificio.mapper";
import type { UnitDTO } from "../dtos/create-unitUI-dto";
import { toCreateUnitUiDto } from "../mappers/unitUI.mapper";

export async function getUnitsByBuilding(idEdificio: string): Promise<UnitDTO[]> {
    const unidades = await getUnits(idEdificio);
    console.log(unidades)
    const dtoUI = unidades.map(unidad => toCreateUnitUiDto(unidad))
    return dtoUI;
}

export async function saveEdificio(edificio: EdificioForm): Promise<Edificio> {
    const dto = toCreateEdificioDto(edificio);
    return await insertEdificio(dto);
}

export async function editEdificio(id: string, form: EdificioForm): Promise<Edificio> {
    const dto = toUpdateEdificioDto(id, form);
    return await updateEdificio(dto);
}