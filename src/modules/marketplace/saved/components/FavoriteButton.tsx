import { useState, useEffect } from "react";
import { useFavorite } from "../hooks/useFavorite.js";

// TODO: refactorizar el componente

type Props = {
    propertyId: string;
    isInitiallyFavorite: boolean;
    variant: string | null;
}

export default function FavoriteButton({ propertyId, isInitiallyFavorite, variant = 'feed' }: Props) {

    const { toggleFavorite } = useFavorite()
    const [isFavorite, setIsFavorite] = useState<boolean>(isInitiallyFavorite); // Valor voleano

    useEffect(() => {
        setIsFavorite(isInitiallyFavorite);
    }, [isInitiallyFavorite]);

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation(); // evita que el click dispare el link del card
        toggleFavorite(propertyId, isFavorite)
        setIsFavorite(!isFavorite)
    };

    return (
        <span
            onClick={handleClick}
            className={`cursor-pointer 
                ${variant == "feed"
                    ? 'absolute top-2 right-2 z-20 p-2 rounded-full bg-white'
                    : 'hover:scale-125'}    
                ${isFavorite
                    ? "text-red-600"
                    : "text-gray-400/70"
                }`}
        >
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="icon icon-tabler icons-tabler-filled icon-tabler-heart"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M6.979 3.074a6 6 0 0 1 4.988 1.425l.037 .033l.034 -.03a6 6 0 0 1 4.733 -1.44l.246 .036a6 6 0 0 1 3.364 10.008l-.18 .185l-.048 .041l-7.45 7.379a1 1 0 0 1 -1.313 .082l-.094 -.082l-7.493 -7.422a6 6 0 0 1 3.176 -10.215z" />
            </svg>
        </span>
    );
}
