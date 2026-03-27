import { useUser } from "@/hooks/useUser";
import FavoriteButton from "../../saved/components/FavoriteButton";
import { useFavoriteProperty } from "../hooks/useFavoriteProperty";

export default function FavoriteButtonDetails({ idProperty }: { idProperty: string }) {
    
    const { isFavorite } = useFavoriteProperty(idProperty)
    const { session } = useUser()

    return (
        <div className="flex gap-1.5 items-center py-1">
            <label>Favorito</label>
            <FavoriteButton
                propertyId={idProperty}
                isInitiallyFavorite={isFavorite}
                variant='detail'
            />
        </div>
    )
}