// favorite.repository.ts
import { supabase } from "@/lib/supabaseClient";

export async function insertFavorite(userId: string, propertyId: string) {

    try {
        const { data, error } = await supabase
            .from("favorites")
            .insert({
                user_id: userId,
                property_id: propertyId
            });

        if (error) throw error
        return {data, error: null}

    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Error desconocido"
        }
    }
}

export async function deleteFavorite(userId: string, propertyId: string) {
    try {
        const { data, error } = await supabase
            .from("favorites")
            .delete()
            .eq("user_id", userId)
            .eq("property_id", propertyId);

        if (error) {
            throw error
        }

        return { data, error: null }

    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Error desconocido al eliminar"
        }
    }
}