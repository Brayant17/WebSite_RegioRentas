import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient"
import FavoriteButton from "./FavoriteButton";

export default function FavoriteButtonDetails({ idProperty }) {
    const [session, setSession] = useState(null);
    const [isFavorite, setIsFavorite] = useState(false)
    useEffect(() => {
        // obtenemos la session
        supabase.auth.getSession()
            .then(({ data }) => setSession(data.session))
    }, [])

    useEffect(() => {
        const checkIfFavorite = async () => {
            if (!session) return;

            const userId = session.user.id

            const { data, error } = await supabase
                .from("favorites")
                .select('id')
                .eq('user_id', userId)
                .eq('property_id', idProperty)
                .maybeSingle(); //devuelve el unico registro o null

            if (error) {
                console.log("Error comprobando favoritos: ", error);
                return;
            }

            setIsFavorite(!!data); //si hay registro es true
        }

        checkIfFavorite();
    }, [session, idProperty])

    return (
        <div className="flex gap-1.5 items-center py-1">
            <label>Favorito</label>
            <FavoriteButton
                propertyId={idProperty}
                session={session}
                isInitiallyFavorite={isFavorite}
                variant='detail'
            />
        </div>
    )
}