import { supabase } from "@/lib/supabaseClient";

export async function getFavorite(idUser: string, idProperty: string) {
    const { data, error } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", idUser)
        .eq("property_id", idProperty)
        .maybeSingle();

    if (error) {
        console.log("Error comprobando favoritos: ", error);
        return;
    }

   

    return data
}