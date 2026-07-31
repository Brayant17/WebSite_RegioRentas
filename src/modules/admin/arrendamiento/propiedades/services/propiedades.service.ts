import type { Edificio } from "../../types/edificios.type";
import { getUnits, insertEdificio, insertUnit, updateEdificio, updateUnit } from "../repositories/propiedades.respository";
import type { EdificioForm } from "../schemas/edificio.schema";
import { toCreateEdificioDto } from "../mappers/edificio.mapper";
import { toUpdateEdificioDto } from "../mappers/updateEdificio.mapper";
import { toCreateUnit, toUpdateUnit } from "../mappers/unit.mapper";
import type { UnidadForm } from "../schemas/unidad.schema";
import type { Unit } from "../../types/Unit";

export async function getUnitsByBuilding(idEdificio: string): Promise<Unit[]> {
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

export async function saveUnidad(unidad: UnidadForm, idEdificio: string) {
    try {
        const dto = toCreateUnit(unidad, idEdificio);
        const unidadNueva = await insertUnit(dto);
        return unidadNueva
    } catch (error) {
        throw error;
    }
}

export async function editUnidad(unidad: UnidadForm, idEdificio: string, idUnidad: number) {
    console.log("Service id unidad: ", idUnidad)
    const dto = toUpdateUnit(unidad, idEdificio, idUnidad);
    return await updateUnit(dto);
}