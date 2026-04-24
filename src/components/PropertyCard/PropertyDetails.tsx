import type { Property } from "@/types/property";

export default function PropertyDetails({ property }: { property: Property }) {
    return (
        <div className="flex items-center gap-3 text-xs text-gray-600 mt-1 flex-wrap">
            <span>{property.bedrooms || 2} rec</span>
            <span>•</span>
            <span>{property.bathrooms || 1} baños</span>
            <span>•</span>
            <span>{property.area || 0} m²</span>
        </div>
    );
}
