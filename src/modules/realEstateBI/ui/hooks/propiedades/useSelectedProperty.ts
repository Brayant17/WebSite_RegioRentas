import { useState } from "react";

export function useSelectedProperty() {
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

    //recordar que se necesitan validaciones del domian entitie, y crear el objeto, para mantener las reglas del negocio

    //operacion o metodo provisional etapa temprana

    return {
        selectedPropertyId,
        selectProperty: setSelectedPropertyId,
    };
}
