import { CreateUnit } from "@/modules/realEstateBI/application/CreateUnit"
import type { CreateUnitInput } from "@/modules/realEstateBI/application/dtos/CreateUnitInput"
import type { UnitDetailsDto } from "@/modules/realEstateBI/application/dtos/UnitDetailsDto"
import { SupabaseUnitRepository } from "@/modules/realEstateBI/infrastructure/SupabaseUnitRepository"
import { useMemo, useState } from "react"

export const useCreateUnit = () => {

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createUnitUseCase = useMemo(() => {
        const repo = new SupabaseUnitRepository();
        return new CreateUnit(repo);
    }, [])

    const createUnit = async (input: CreateUnitInput) => {
        setLoading(true)
        setError(null)

        try {
            await createUnitUseCase.execute(input);
        } catch (err: any) {
            setError(err.message ?? "Error creating unit");
            throw err;
        } finally {
            setLoading(false);
        }
    }

    return {
        createUnit,
        loading,
        error,
    }

}