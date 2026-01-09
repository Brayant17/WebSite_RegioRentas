// infrastructure/propertyRepo.ts
// crear el repo de supabase para las propiedades
import type { PropertyDTO } from '../application/dtos/PropertyDTO';
import type { Property } from '../domain/entities/Property';
import type { PropertyRepository } from '../domain/repositories/PropertyRepository';
import { supabase } from '@/lib/supabaseClient';

export class SupabasePropertyRepo implements PropertyRepository {
    async save(property: Property): Promise<void> {
        const { data, error } = await supabase
            .from('rental_properties')
            .insert([
                {
                    name: property.name,
                    address: property.address,
                    city: property.city ?? "",
                    state: property.state ?? "",
                    postal_code: property.postalCode ?? "",
                    active: property.isActive()
                }
            ]);
        if (error) {
            throw new Error(`Error saving property: ${error.message}`);
        }
    }
    async getAll(): Promise<PropertyDTO[]> {
        const { data, error } = await supabase
            .from('rental_properties')
            .select('*');
        if (error) {
            throw new Error(`Error fetching properties: ${error.message}`);
        }
        return data.map(item => ({
            id: item.id,
            name: item.name,
            address: item.address,
            city: item.city,
            state: item.state,
            postalCode: item.postal_code,
            active: item.active
        }));
    }
}