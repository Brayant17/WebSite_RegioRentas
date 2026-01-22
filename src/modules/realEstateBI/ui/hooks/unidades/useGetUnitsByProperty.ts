import { useMemo, useState } from "react";
import { SupabaseUnitRepository } from "@/modules/realEstateBI/infrastructure/SupabaseUnitRepository";
import { GetUnitCardsUseCase } from "@/modules/realEstateBI/application/GetUnitCardsUseCase";
import type { UnitCardDto } from "@/modules/realEstateBI/application/dtos/UnitCardDto";

export default function useUnitCards() {
    const [units, setUnits] = useState<UnitCardDto[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const useCase = useMemo(() => {
        const repo = new SupabaseUnitRepository();
        return new GetUnitCardsUseCase(repo);
    }, []);

    const fetchUnits = async (
        propertyId: string,
        filter: "ALL" | "AVAILABLE" | "OCCUPIED" | "DELINQUENT" = "ALL"
    ) => {
        setLoading(true);
        setError(null);

        try {
            const result = await useCase.execute(propertyId, filter);
            console.log("este es del hook", result)
            setUnits(result);
        } catch (err: any) {
            setError(err?.message ?? "Error loading units");
        } finally {
            setLoading(false);
        }
    };

    return {
        units,
        fetchUnits,
        loading,
        error,
    };
}
