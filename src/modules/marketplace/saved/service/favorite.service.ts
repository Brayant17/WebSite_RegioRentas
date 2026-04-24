import { deleteFavorite, insertFavorite } from "../repositories/favorite.repository"

export async function setFavorite(userId: string, propertyId: string) {
    if (!userId) {
        return { data: null, error: "Usuario no autenticado" }
    }

    if (!propertyId) return { data: null, error: "Propiedad es requerida" }

    const { data, error } = await insertFavorite(userId, propertyId)

    if (error) {
        return { data: null, error: "No se pudo guardar favorito" }
    }

    return { data, error: null };
}


export async function dropFavorite(userId: string, propertyId: string) {

    if (!userId) {
        return { data: null, error: "Usuario no autenticado" }
    }

    if (!propertyId) return { data: null, error: "Propiedad es requirida" }

    const { data, error } = await deleteFavorite(userId, propertyId);

    if (error) {
        return { data: null, error: "No se pudo eliminar favorito" }
    }

    return { data, error: null }

}