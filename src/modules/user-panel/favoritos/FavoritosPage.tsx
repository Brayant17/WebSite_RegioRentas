import { PropertyCard } from "@/components/PropertyCard/PropertyCard.tsx";
import { useFavoriteUser } from "../hooks/useFavoriteUser";
import SkeletonCard from "@/components/SkeletonCard"

export default function FavoritosPage() {

    const { favorites, loading, error } = useFavoriteUser();

    console.log('Favorites in FavoritosPage:', favorites);

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
                {[...Array(6)].map((_, i) => (
                    <SkeletonCard key={i} /> // 👈 muestra 6 skeletons
                ))}
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {
                favorites && favorites.length > 0 && (
                    favorites.map((favorite) => {
                        return (
                            <PropertyCard
                                key={favorite.id}
                                property={favorite.property}
                                isFavorite={true}
                            />
                        );
                    })
                )
            }
        </div>
    );
}