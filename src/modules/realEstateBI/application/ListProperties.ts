// src/modules/realEstateBI/application/ListProperties.ts
// crear caso de uso para listar propiedades
import type { PropertyRepository } from '@/modules/realEstateBI/domain/repositories/PropertyRepository';
import type { PropertyDTO } from './dtos/PropertyDTO';

export class ListProperties {
    constructor(private propertyRepository: PropertyRepository) { }

    async execute(): Promise<PropertyDTO[]> {
        return await this.propertyRepository.getAll();
    }
}