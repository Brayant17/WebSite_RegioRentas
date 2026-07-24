import { useState } from "react";
import { EdificiosCombobox } from "./ComboboxEdificios";

type Edificio = {
    id: string;
    nombre: string;
    direccion?: string;
    unidades: Unidad[];
}

interface Unidad {
    nombre: string;
    id: string,
    precio_renta: number | null,
    tipo: string | null
}

export function ListProperties({ buildingsAndUnits }: { buildingsAndUnits: Edificio[] }) {

    const [selected, setselected] = useState<{ id: string, nombre: string } | null>(null)

    const edificios = buildingsAndUnits.map((edificio) => ({
        id: edificio.id,
        nombre: edificio.nombre
    }))

    const selectedBuilding = buildingsAndUnits.find(
        (building) => building.id === selected?.id
    );

    const units = selectedBuilding?.unidades ?? [];

    return (
        <>
            <div className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight">
                    Solicitud de arrendamiento
                </h1>

                <div className="mt-6 max-w-md">
                    <EdificiosCombobox
                        edificios={edificios}
                        selected={selected}
                        onSelect={setselected}
                    />
                </div>

                <p className="mt-3 text-muted-foreground">
                    Selecciona la habitación o departamento para iniciar tu solicitud.
                </p>
            </div>

            {!selectedBuilding && (
                <div className="mt-10 rounded-lg border border-dashed p-10 text-center">
                    <h3 className="text-lg font-medium">
                        Selecciona un edificio
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">
                        Después podrás elegir la unidad para iniciar la solicitud de arrendamiento.
                    </p>
                </div>
            )}

            {selectedBuilding && (
                <div>
                    <div className="mb-6 flex items-baseline justify-between border-b pb-3">
                        <div>
                            <h2 className="text-2xl font-semibold">
                                {selectedBuilding.nombre}
                            </h2>

                            {selectedBuilding.direccion && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    📍 {selectedBuilding.direccion}
                                </p>
                            )}
                        </div>

                        <span className="text-sm text-muted-foreground">
                            {units.length}{" "}
                            {units.length === 1 ? "unidad disponible" : "unidades disponibles"}
                        </span>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                        {units.map((unidad) => (
                            <div
                                key={unidad.id}
                                className="flex h-full flex-col rounded-xl border bg-card p-6 shadow-sm transition hover:shadow-md"
                            >
                                <div className="space-y-4 flex-1">
                                    <div>
                                        <h3 className="text-xl font-semibold">
                                            {unidad.nombre}
                                        </h3>

                                        {unidad.tipo && (
                                            <p className="text-sm text-muted-foreground">
                                                {unidad.tipo}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Renta mensual
                                        </span>

                                        <span className="font-semibold text-primary">
                                            {new Intl.NumberFormat("es-MX", {
                                                style: "currency",
                                                currency: "MXN",
                                                maximumFractionDigits: 0,
                                            }).format(unidad.precio_renta ?? 0)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Estado
                                        </span>

                                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                            Disponible
                                        </span>
                                    </div>
                                </div>

                                <a
                                    href={`/arrendamiento/solicitud/${unidad.id}`}
                                    className="mt-6 inline-flex justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                >
                                    Iniciar solicitud
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
}