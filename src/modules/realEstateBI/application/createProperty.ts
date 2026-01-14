// application/createProperty.ts
// crear caso de uso para crear una propiedad
import { Property } from '../domain/entities/Property';
import type { PropertyRepository } from '@/modules/realEstateBI/domain/repositories/PropertyRepository';
import type { CreatePropertyInput } from './dtos/CreatePropertyInput';

export class CreateProperty {
    constructor(private propertyRepository: PropertyRepository) { }

    async execute(input: CreatePropertyInput): Promise<void> {
        const property = new Property(
            crypto.randomUUID(), // Id temporal
            input.name,
            input.address,
            input.city ?? '',
            input.state,
            input.postalCode,
            input.active ?? true
        )
        await this.propertyRepository.insert(property);
    }
}