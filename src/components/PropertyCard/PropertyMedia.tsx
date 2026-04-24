import PropertySlider from "@/components/PropertySlider";
import FavoriteButton from "@/modules/marketplace/saved/components/FavoriteButton";
import PropertyBadges from "./PropertyBadge";
import type { Property } from "@/types/property";

type Props = {
    property: Property;
    isFavorite: boolean;
};

export default function PropertyMedia({ property, isFavorite }: Props) {
    const dominio = window.location.origin;
    return (
        <div className="relative w-full aspect-[4/3] sm:aspect-[3/2] flex items-center justify-center">
            <a href={`${dominio}/propiedad/${property.slug}`} className="block w-full h-full">
                {property.property_images?.length > 0 ? (
                    <PropertySlider images={property.property_images} name={property.title} />
                ) : (
                    <span className="text-slate-400 text-sm">Sin imagen</span>
                )}
            </a>

            <div className="absolute top-0.5 right-0.5 z-10">
                <FavoriteButton propertyId={property.id} isInitiallyFavorite={isFavorite} variant={'feed'} />
            </div>

            <PropertyBadges property={property} />
        </div>
    );
}
