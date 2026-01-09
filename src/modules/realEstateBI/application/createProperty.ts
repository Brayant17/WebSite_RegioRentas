// application/createProperty.ts
// crear caso de uso para crear una propiedad
import { Property } from '../domain/entities/Property';
import type { PropertyRepository } from '@/modules/realEstateBI/domain/repositories/PropertyRepository';

export class CreateProperty {
    constructor(private propertyRepository: PropertyRepository) { }

    async execute(property: Property): Promise<void> {
        await this.propertyRepository.save(property);
    }
}