//hooks/propiedades/useRealStateBi
import type { PropertyDTO } from "@/modules/realEstateBI/application/dtos/PropertyDTO";
import { GetProperty } from "@/modules/realEstateBI/application/GetProperty";
import { SupabasePropertyRepo } from "@/modules/realEstateBI/infrastructure/propertyRepo";
import { useEffect, useMemo, useState } from "react";

export function useRealEstateBI() {
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
    const [property, setProperty] = useState<PropertyDTO | null>(null);
    const [loading, setLoading] = useState(false);

    const getPropertyUseCase = useMemo(() => {
        const repo = new SupabasePropertyRepo();
        return new GetProperty(repo);
    }, []);

    const fetchProperty = async (id: string) => {
        setLoading(true);
        const data = await getPropertyUseCase.execute(id);
        setProperty(data);
        setLoading(false);
    }

    useEffect(() => {
        if (selectedPropertyId) {
            fetchProperty(selectedPropertyId);
        }
    }, [selectedPropertyId])

    return {
        selectedPropertyId,
        selectProperty: setSelectedPropertyId,
        property,
        refreshProperty: () => {
            if (selectedPropertyId) {
                fetchProperty(selectedPropertyId);
            }
        }
    }

}
