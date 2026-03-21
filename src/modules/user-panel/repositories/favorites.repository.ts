// favorites.repository.ts
import { supabase } from "@/lib/supabaseClient";
import type { FavoriteFromDB } from "../types/FavoriteFromDB";
import type { Favorite } from "../types/favorite";

export async function getPropertyFavorites({ userId }: { userId: string }): Promise<FavoriteFromDB[]> {
    const { data, error } = await supabase
        .from('favorites')
        .select(`
                id,
                property:properties(
                    id,
                    title,
                    description,
                    price,
                    municipio,
                    colonia,
                    slug,
                    property_type,
                    operation,
                    property_images(url)
                )
        `)
        .eq('user_id', userId);


    if (!data) return []

    return data as unknown as FavoriteFromDB[]
}