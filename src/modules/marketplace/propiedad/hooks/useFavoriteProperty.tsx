import { useUser } from "@/hooks/useUser";
import { useEffect, useState } from "react"
import { getPropertyFAvorite } from "../services/favorite.service";

export function useFavoriteProperty(idProperty: string) {

    const [isFavorite, setIsFavorite] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const { idUser } = useUser();


    useEffect(() => {
        if (!idProperty || !idUser) {
            setIsLoading(false);
            return;
        }

        const checkStatus = async () => {
            try {
                setIsLoading(true);
                const result = await getPropertyFAvorite(idUser, idProperty);
                setIsFavorite(result);
            } catch (err){
                setError(err as Error);
            } finally {
                setIsLoading(false);
            }
        }

        checkStatus();
    }, [idUser, idProperty])

    return {isFavorite,  setIsFavorite, isLoading, error,}
}