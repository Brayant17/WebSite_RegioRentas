import { useState } from "react";
import { dropFavorite, setFavorite } from "../service/favorite.service";
import { useUser } from "@/hooks/useUser";

export function useFavorite() {
    const [loading, setLoading] = useState(false);
    const { session, idUser } = useUser();

    const toggleFavorite = async (propertyId: string, isFavorite: boolean) => {
        
        if(!session){
            window.location.href = "/login";
        }
        
        if (!idUser) return;

        setLoading(true);

        if(!isFavorite){
            const { data, error } = await setFavorite(idUser, propertyId);
        }else{
            const { data, error } = await dropFavorite(idUser, propertyId);
        }

        setLoading(false);
    };

    return {
        toggleFavorite,
        loading
    };
}
