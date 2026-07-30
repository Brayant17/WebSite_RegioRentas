import { supabase } from "@/lib/supabaseClient";

export async function getUnits(idEdificio: string){
    const {data, error} = await supabase
        .from("unidades")
        .select(`*`)
        .eq("edificio_id", idEdificio);

    if(error){
        throw error;
    }

    return data
}