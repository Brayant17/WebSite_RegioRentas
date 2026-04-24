import PropertiesPage from "@/modules/admin/publicaciones/Page.js";
import {
    fetchPropertiesPage,
    fetchFavoritesByUser,
} from "../repositories/propertyRepository.js";

import type { Filters } from "../types/filters.ts";

type PropertiesPage = {
    page: number;
    limit: number;
    filters: Filters;
}

type FetchParams = {
    start: number;
    end: number;
    filters: Filters; // 👈 cambia esto
};


export async function getPropertiesPage({ page, limit, filters }: PropertiesPage) {
    const start = page * limit;
    const end = start + limit - 1;

    const { data, error } = await fetchPropertiesPage({ start, end, filters });

    if (error) {
        console.error("[propertyService] Error fetching properties:", error);
        throw error;
    }

    // Normalize: flatten property_images → images[]
    const properties = (data ?? []).map((property) => ({
        ...property,
        images: property.property_images?.map((img) => img.url) ?? [],
    }));

    return {
        properties,
        hasMore: data.length === limit,
    };
}

export async function getFavoriteIds(userId: string) {
    const { data, error } = await fetchFavoritesByUser(userId);

    if (error) {
        console.error("[propertyService] Error fetching favorites:", error);
        throw error;
    }

    return (data ?? []).map((fav) => fav.property_id);
}