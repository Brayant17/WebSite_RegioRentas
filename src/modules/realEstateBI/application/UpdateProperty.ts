import { Property } from "../domain/entities/Property";
import type { PropertyRepository } from "../domain/repositories/PropertyRepository";

export interface UpdatePropertyDTO {
    id: string,
    name: string;
    address: string;
    city?: string;
    state?: string;
    postalCode?: string;
    active: boolean;
}

export class UpdateProperty {
    constructor(private propertyRepository: PropertyRepository) { }

    //recordar que se necesitan validaciones del domian entitie, y crear el objeto, para mantener las reglas del negocio

    //operacion o metodo provisional etapa temprana

    async execute(data: UpdatePropertyDTO): Promise<void> {

        const property = await this.propertyRepository.getById(data.id);

        if (!property) {
            throw new Error("Property not found");
        }

        property.updateDetails({
            name: data.name,
            address: data.address,
            city: data.city,
            state: data.state,
            postalCode: data.postalCode
        })

        data.active ? property.activate() : property.deactive()

        await this.propertyRepository.save(property)
    }
}