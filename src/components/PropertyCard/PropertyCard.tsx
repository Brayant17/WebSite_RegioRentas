import type { Property } from "@/types/property.js";
import PropertyHeader from "./PropertyHeader.js";
import PropertyMedia from "./PropertyMedia.js";
import PropertyPrice from "./PropertyPrice.js";
import PropertyDetails from "./PropertyDetails.js";

type PropertyCardProps = {
    property: Property;
    isFavorite: boolean;
    badge?: string;
};


function PropertyCard({ property, isFavorite, badge }: PropertyCardProps) {
    // console.log('Property in PropertyCard:', property);
    return (
        <article className="rounded-lg w-full overflow-hidden cursor-pointer">
            {/* Imagen / Slider */}
            <PropertyMedia property={property} isFavorite={isFavorite} />

            {/* Contenido */}
            <div className="py-3 flex flex-col gap-1">
                <PropertyHeader property={property} />
                <PropertyPrice property={property} />
                <PropertyDetails property={property} />
            </div>
        </article>
    );
}

export { PropertyCard };
