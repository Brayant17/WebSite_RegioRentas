import { UpdateProperty } from "@/modules/realEstateBI/application/UpdateProperty";
import { SupabasePropertyRepo } from "@/modules/realEstateBI/infrastructure/propertyRepo";
import { useMemo, useState } from "react";
import type { UpdatePropertyDTO } from "@/modules/realEstateBI/application/UpdateProperty";

export const useEditProperty = () => {
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [loading, setLoading] = useState(false);

    const updatePropertyUseCase = useMemo(() => {
        const repo = new SupabasePropertyRepo();
        return new UpdateProperty(repo);
    }, []);

    const putProperty = async (data: UpdatePropertyDTO) => {
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            await updatePropertyUseCase.execute(data);
            setSuccess(true);
        } catch (err) {
            setError(err as Error);
            throw err; // opcional, si el modal lo necesita
        } finally {
            setLoading(false);
        }
    };

    return {
        putProperty,
        success,
        loading,
        error,
    };
};
