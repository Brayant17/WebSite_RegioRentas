import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox"
import { useState } from "react"

type Edificio = {
    id: string,
    nombre: string
}

type Props = {
    edificios: Edificio[]
    selected: Edificio | null
    onSelect: (edificio: Edificio | null) => void
}

export function EdificiosCombobox({ edificios, selected, onSelect }: Props) {

    return (
        <Combobox
            items={edificios}
            value={selected}
            onValueChange={onSelect}
            itemToStringLabel={(item) => item?.nombre ?? ""}
        >
            <ComboboxInput placeholder="Selecciona el edificio" />
            <ComboboxContent>
                <ComboboxEmpty>No se encontraron edificios.</ComboboxEmpty>
                <ComboboxList>
                    {(item) => (
                        <ComboboxItem key={item.id} value={item}>
                            {item.nombre}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    )
}