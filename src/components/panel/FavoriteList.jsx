import { supabase } from "../../lib/supabaseClient"
import { useEffect, useState } from "react"
import { PropertyCard } from "../property/PropertyCard"
import SkeletonCard from "../property/SkeletonCard"

export default function FavoriteList() {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [favoritos, setFavoritos] = useState([])
    const [loading, setLoading] = useState(true) // 👈 Estado de carga

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }

        fetchUser()
    }, [])

    // obtener session
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) =>
            setSession(session)
        );
        return () => listener.subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return

        const fetchFavoritos = async () => {
            setLoading(true) // 🟡 Empieza la carga
            const { data, error } = await supabase
                .from('favorites')
                .select(`
                        id,
                        property:properties(
                            id,
                            title,
                            description,
                            price,
                            municipio,
                            colonia,
                            slug,
                            property_type,
                            operation,
                            property_images(url)
                        )
                `)
                .eq('user_id', user.id)

            if (error) console.error(error)
            else setFavoritos(data);
            setLoading(false) // 🟢 Termina la carga
        }

        fetchFavoritos()
    }, [user])

    // 🔹 Mostrar Skeletons mientras carga
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
                {[...Array(6)].map((_, i) => (
                    <SkeletonCard key={i} /> // 👈 muestra 6 skeletons
                ))}
            </div>
        )
    }
    // 🔹 Si no hay favoritos
    if (!favoritos.length) return <p>No tienes propiedades favoritas</p>
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {favoritos.map(({ property }) => (
                <PropertyCard
                    key={property.id}
                    id={property.id}
                    property={{
                        ...property,
                        images: property.property_images?.map((img) => img.url) || [],
                    }}
                    isFavorite={true}
                    slug={property.slug}
                    session={session}
                />
            ))}
        </div>
    )
}
