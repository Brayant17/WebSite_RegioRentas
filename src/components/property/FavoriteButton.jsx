import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient.js";

export default function FavoriteButton({ propertyId, isInitiallyFavorite, session, variant = 'feed' }) {
    // puede ser feed o detail
    const [favorite, setFavorite] = useState(isInitiallyFavorite); // Valor voleano

    useEffect(() => {
        setFavorite(isInitiallyFavorite);
    }, [isInitiallyFavorite]);

    const handleClick = async (e) => {
        e.stopPropagation(); // evita que el click dispare el link del card

        if (!session) {
            window.location.href = "/login";
            return;
        }

        try {
            if (!favorite) {
                await supabase.from("favorites").insert({
                    user_id: session.user.id,
                    property_id: propertyId,
                });
            } else {
                await supabase
                    .from("favorites")
                    .delete()
                    .eq("user_id", session.user.id)
                    .eq("property_id", propertyId);
            }

            setFavorite(!favorite);
        } catch (err) {
            console.error("Error al actualizar favoritos:", err);
        }
    };

    return (
        <span
            onClick={handleClick}
            className={`cursor-pointer 
                ${variant == "feed"
                    ? 'absolute top-2 right-2 z-20 p-2 rounded-full bg-white'
                    : 'hover:scale-125'}    
                ${favorite
                    ? "text-red-600"
                    : "text-gray-400/70"
                }`}
        >
            <svg
                width="24"
                height="24"
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
