import type { PropertyDTO } from "@/modules/realEstateBI/application/dtos/PropertyDTO";
import { GetProperty } from "@/modules/realEstateBI/application/GetProperty";
import { SupabasePropertyRepo } from "@/modules/realEstateBI/infrastructure/propertyRepo";
import { useEffect, useMemo, useState } from "react";

export function useProperty(propertyId: string | null) {
    const [property, setProperty] = useState<PropertyDTO | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getPropertyUseCase = useMemo(() => {
        const repo = new SupabasePropertyRepo();
        return new GetProperty(repo);
    }, []);

    useEffect(() => {
        if (!propertyId) return;

        setLoading(true);
        setError(null);

        getPropertyUseCase
            .execute(propertyId)
            .then(setProperty)
            .catch(() => setError("Error al obtener la propiedad"))
            .finally(() => setLoading(false));
    }, [propertyId, getPropertyUseCase]);

    return { property, loading, error };
}
