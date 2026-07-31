import { supabase } from "@/lib/supabaseClient";
import type { CreateEdificioDto } from "../dtos/create-edifico-dto";
import type { Edificio } from "../../types/edificios.type";
import type { UpdateEdificioDTO } from "../dtos/update-edificio-dto";
import type { Unit } from "@/modules/admin/arrendamiento/types/Unit";
import type { CreateUnitDto } from "../dtos/CreateUnitDto";
import type { UpdateUnitDto } from "../dtos/UpdateUnitDto";

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
            edificio_id: unit.edificio_id,
            nombre: unit.nombre,
            numero: unit.numero,
            piso: unit.piso,
            tipo: unit.tipo,
            recamaras: unit.recamaras,
            area: unit.area,
            ubicacion: unit.ubicacion,
            precio_renta: unit.precio_renta,
            estatus: unit.estatus,
            created_at: unit.created_at,
            updated_at: unit.updated_at
        }
    })
}

export async function insertUnit(dto: CreateUnitDto) {

    const { data, error } = await supabase
        .from("unidades")
        .insert(dto)
        .select()
        .single();

    if (error) {
        throw error
    }

    return data
}

export async function updateUnit(dto: UpdateUnitDto) {

    const { id, ...values } = dto;

    const { data, error } = await supabase
        .from("unidades")
        .update(values)
        .eq("id", id)
        .select()
        .single();

    if(error){
        throw error
    }

    return data;
}


export async function insertEdificio(edifico: CreateEdificioDto): Promise<Edificio> {
    const { data, error } = await supabase
        .from("edificios")
        .insert(edifico)
        .select()
        .single();

    if (error) {
        throw error
    }

    if (!data) {
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