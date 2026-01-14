// infrastructure/propertyRepo.ts
// crear el repo de supabase para las propiedades
import type { PropertyDTO } from '../application/dtos/PropertyDTO';
import { Property } from '../domain/entities/Property';
import type { PropertyRepository } from '../domain/repositories/PropertyRepository';
import { supabase } from '@/lib/supabaseClient';

export class SupabasePropertyRepo implements PropertyRepository {

    async insert(property: Property): Promise<void> {
        const { error: error } = await supabase
            .from('rental_properties')
            .insert({
                name: property.getName(),
                address: property.getAddress(),
                city: property.getCity() ?? "",
                state: property.getState() ?? "",
                postal_code: property.getPostalCode() ?? "",
                active: property.isActive()
            })
        if (error) {
            throw new Error(`Error saving property: ${error.message}`)
        }
    }

    async save(property: Property): Promise<void> {
        const { data, error } = await supabase
            .from('rental_properties')
            .upsert([
                {
                    id: property.id,
                    name: property.getName(),
                    address: property.getAddress(),
                    city: property.getCity() ?? "",
                    state: property.getState() ?? "",
                    postal_code: property.getPostalCode() ?? "",
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
            .select('*')
            .order('created_at', {ascending: false});
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

    async getById(id: string): Promise<Property> {
        const { data, error } = await supabase
            .from('rental_properties')
            .select('*')
            .eq('id', id);
        if (error) {
            throw new Error(`Error fetching property: ${error.message}`);
        }
        if (!data.length) {
            throw new Error("Property not found");
        }
        const item = data[0];
        return new Property(
            item.id,
            item.name,
            item.address,
            item.city,
            item.state,
            item.postal_code,
            item.active
        );
    }
}