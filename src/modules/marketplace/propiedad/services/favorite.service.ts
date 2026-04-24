import { getFavorite } from "../repositories/favorite.repository";

export async function getPropertyFAvorite(idUser: string, idProperty: string): Promise<boolean>{
    if(!idUser || !idProperty){
        return false;
    }

    try {
        const property = await getFavorite(idUser, idProperty); 
        return !!property;
    } catch (error) {
        console.log("Error fetching favorites: ", error);
        return false;
    }
}