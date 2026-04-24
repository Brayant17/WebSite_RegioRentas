import type { Property } from "@/types/property";

export default function PropertyHeader({ property }: { property: Property }) {
    return (
        <>
            <div className="flex justify-between items-start">
                <h3 className="text-sm font-semibold text-black truncate">
                    {property.title}
                </h3>
                <span className="text-xs font-medium text-gray-600">
                    {property.property_type || "Departamento"}
                </span>
            </div>

            <p className="text-xs text-gray-500 truncate">
                {property.municipio} • {property.colonia}
            </p>
        </>
    );
}
