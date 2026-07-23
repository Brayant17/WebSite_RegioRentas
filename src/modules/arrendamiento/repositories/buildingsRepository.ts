import { supabase } from "@/lib/supabaseClient";

export async function getBuildingsAndUnits() {
    const { data, error } = await supabase
        .from("edificios")
        .select("*, unidades(*)");

    if (error) {
        console.error("Error fetching buildings and units:", error);
        return [];
    }

    return data;
}