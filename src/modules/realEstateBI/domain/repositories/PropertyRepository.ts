// domain/repositories/PropertyRepository.ts
// crear el repositorio contrato para las propiedades
import type { PropertyDTO } from '../../application/dtos/PropertyDTO';
import { Property } from '../entities/Property';


export interface PropertyRepository {
    insert(property: Property): Promise<void>
    save(property: Property): Promise<void>;
    getAll(): Promise<PropertyDTO[]>;
    getById(id: string): Promise<Property | null>;
}