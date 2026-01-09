// domain/repositories/PropertyRepository.ts
// crear el repositorio contrato para las propiedades
import type { PropertyDTO } from '../../application/dtos/PropertyDTO';
import { Property } from '../entities/Property';


export interface PropertyRepository {
    save(property: Property): Promise<void>;
    getAll(): Promise<PropertyDTO[]>;
}