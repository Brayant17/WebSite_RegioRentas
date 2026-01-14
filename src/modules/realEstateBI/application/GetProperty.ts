//application/GetProperty.ts
import type { PropertyRepository } from "../domain/repositories/PropertyRepository";
import type { PropertyDTO } from "./dtos/PropertyDTO";
import { PropertyMapper } from "./mappers/PropertyMapper";

export class GetProperty {
    constructor(private propertyRepository: PropertyRepository) { }

    async execute(id: string): Promise<PropertyDTO> {

        const property = await this.propertyRepository.getById(id);

        if (!property) {
            throw new Error("Property not found")
        }

        return PropertyMapper.toDTO(property)
    }
}