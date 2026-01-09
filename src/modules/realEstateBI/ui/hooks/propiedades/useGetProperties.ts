import { useMemo, useState } from 'react';
import { SupabasePropertyRepo } from '../../../infrastructure/propertyRepo';
// import { GetAllProperties } from '../../../application/getAllProperties';
import type { PropertyDTO } from '@/modules/realEstateBI/application/dtos/PropertyDTO';
import { ListProperties } from '@/modules/realEstateBI/application/ListProperties';


export const useGetProperties = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [properties, setProperties] = useState<PropertyDTO[]>([]);

    const getAllPropertiesUseCase = useMemo(() => {
        const repo = new SupabasePropertyRepo();
        return new ListProperties(repo);
    }, []);

    const fetchProperties = async () => {
        setLoading(true);
        setError(null);
        try {
            const props = await getAllPropertiesUseCase.execute();
            setProperties(props);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return {
        properties,
        fetchProperties,
        loading,
        error,
    };
} 