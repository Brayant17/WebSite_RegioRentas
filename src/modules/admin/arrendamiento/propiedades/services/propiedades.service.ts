import { getUnits } from "../repositories/propiedades.respository";

export async function getUnitsByBuilding(idEdificio: string){
    const unidades = await getUnits(idEdificio);
    return unidades;
}