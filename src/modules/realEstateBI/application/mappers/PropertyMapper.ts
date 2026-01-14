// application/mappers/PropertyMapper.ts

import type { Property } from "../../domain/entities/Property";
import type { PropertyDTO } from "../dtos/PropertyDTO";

export class PropertyMapper {
    static toDTO(property: Property): PropertyDTO {
        return {
            id: property.id,
            name: property.getName(),
            address: property.getAddress(),
            city: property.getCity(),
            state: property.getState(),
            postalCode: property.getPostalCode(),
            active: property.isActive(),
        }
    }
}