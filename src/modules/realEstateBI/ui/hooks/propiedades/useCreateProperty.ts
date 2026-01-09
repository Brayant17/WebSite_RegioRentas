// hooks/useCreateProperty.ts
import { useMemo, useState } from 'react';
import { Property } from '../../../domain/entities/Property';
import { SupabasePropertyRepo } from '../../../infrastructure/propertyRepo';
import { CreateProperty } from '../../../application/createProperty';
import type { CreatePropertyInput } from '../../../application/dtos/CreatePropertyInput';

export const useCreateProperty = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);


    const createPropertyUseCase = useMemo(() => {
        const repo = new SupabasePropertyRepo();
        return new CreateProperty(repo);
    }, []);

    const createProperty = async (input: CreatePropertyInput) => {
        setLoading(true);
        setError(null);
        try {
            const property = new Property('', input.name, input.address, input.city, input.state, input.postalCode, input.active ?? true);
            await createPropertyUseCase.execute(property);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return {
        createProperty,
        loading,
        error,
    };
}