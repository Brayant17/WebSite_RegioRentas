// useFavoriteUser.ts
import { useEffect, useState } from "react";
import { getUserFavorites } from "../services/favorites.service";
import { useUser } from "@/hooks/useUser";
import type { Favorite } from "../types/favorite";


export function useFavoriteUser() {
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { idUser } = useUser();

    async function fetchFavorites(userId: string) {
        setLoading(true);
        setError(null);
        try {
            const userFavorites = await getUserFavorites(userId);
            setFavorites(userFavorites);
            
        } catch (error) {
            console.error('Error fetching user favorites:', error);
            setError('Failed to fetch favorites. Please try again later.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!idUser) return;
        fetchFavorites(idUser);
    }, [idUser]);

    return {
        favorites,
        loading,
        error,
    };
}