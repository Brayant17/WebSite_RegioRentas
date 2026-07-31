import { supabase } from "@/lib/supabaseClient";
import type { CreateEdificioDto } from "../dtos/create-edifico-dto";
import type { Edificio } from "../../types/edificios.type";
import type { UpdateEdificioDTO } from "../dtos/update-edificio-dto";
import type { Unit } from "@/modules/admin/arrendamiento/types/unit.type";

export async function getUnits(idEdificio: string): Promise<Unit[]> {
    const { data, error } = await supabase
        .from("unidades")
        .select(`*`)
        .eq("edificio_id", idEdificio);

    if (error) {
        throw error;
    }

    return data?.map(unit => {
        return {
            id: unit.id,
            name: unit.nombre,
            floor: unit.piso,
            location: unit.ubicacion,
            bedrooms: unit.recamaras,
            area: unit.area,
            status: unit.estatus,
            tenant: null,
            suggestedRent: unit.precio_renta,
            vacantSince: unit.created_at
        }
    })
}

export async function insertEdificio(edifico: CreateEdificioDto): Promise<Edificio> {
    const { data, error } = await supabase
        .from("edificios")
        .insert(edifico)
        .select()
        .single();

    if(error){
        throw error
    }

    if(!data){
        throw new Error("No se recibió información del edificio.");
    }

    return data
}

export async function updateEdificio(dto: UpdateEdificioDTO): Promise<Edificio> {

    const { id, ...values } = dto;

    const { data, error } = await supabase
        .from("edificios")
        .update(values)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;

    return data;
}