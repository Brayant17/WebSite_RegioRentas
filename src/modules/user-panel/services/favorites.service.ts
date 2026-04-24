// favorites.service.ts
// import { UserFavorite } from '../types';
import { getPropertyFavorites } from '../repositories/favorites.repository';
import type { Favorite } from '../types/favorite';

export async function getUserFavorites(userId: string): Promise<Favorite[]> {
    if (!userId) {
        throw new Error('User ID is required to fetch favorites');
    }
    const favorites = await getPropertyFavorites({ userId });
    return favorites
}