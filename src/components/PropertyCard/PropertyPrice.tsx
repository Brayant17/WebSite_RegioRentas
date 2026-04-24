import type { Property } from "@/types/property";

export default function PropertyPrice({ property }: { property: Property }) {
    const priceNormalized = property.price.toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 0,
    });

    return (
        <div className="flex items-center gap-2">
            <p className="font-bold text-md truncate">{priceNormalized}</p>

            <span
                className={`text-xs font-medium px-2 py-0.5 rounded ${
                    property.operation === "Renta"
                        ? "bg-red-50 text-red-600 border border-red-100"
                        : "bg-neutral-900 text-white"
                }`}
            >
                {property.operation}
            </span>
        </div>
    );
}
