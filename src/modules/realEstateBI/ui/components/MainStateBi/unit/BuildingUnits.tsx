import { useEffect } from "react";
import useUnitCards from "@/modules/realEstateBI/ui/hooks/unidades/useGetUnitsByProperty";
import UnitCard from "./UnitCard";

export default function BuildingUnits({ propertyID }: { propertyID: string }) {
    const { units, fetchUnits, loading, error } = useUnitCards();

    useEffect(() => {
        fetchUnits(propertyID, "ALL");
        console.log(units)
    }, [propertyID]);

    if (loading) {
        return <div className="p-6 text-slate-500">Cargando unidades…</div>;
    }

    if (error) {
        return <div className="p-6 text-red-500">{error}{}</div>;
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {units.map(unit => (
                    <UnitCard
                        key={unit.id}
                        id={unit.code}
                        name={unit.name}
                        floor={unit.floor ?? "—"}
                        status={unit.status}
                        tenant={
                            unit.tenant
                                ? {
                                    name: unit.tenant.name,
                                    initials: unit.tenant.name
                                        .split(" ")
                                        .map(w => w[0])
                                        .join("")
                                        .slice(0, 2),
                                }
                                : undefined
                        }
                        expiry={unit.expiry}
                        features={unit.features}
                        rent={unit.rent ?? "—"}
                        paymentStatus={
                            unit.status === "Moroso"
                                ? "pendiente"
                                : unit.status === "Ocupado"
                                    ? "al día"
                                    : undefined
                        }
                        vacantDays={unit.status === "Disponible" ? 0 : undefined}
                    />
                ))}
                <UnitCard
                    id="2A"
                    name="Unidad 2-A"
                    floor="Piso 2 • Vista Calle"
                    status="Disponible"
                    features="2 Hab • 85m²"
                    rent="$1,250.00"
                    vacantDays={12}
                />
            </div>
        </div>
    );
}


// import { useEffect } from "react";
// import useGetUnitsByProperty from "../../../hooks/unidades/useGetUnitsByProperty";
// import UnitCard from "./UnitCard";

// export default function BuildingUnits({ propertyID }: { propertyID: string }) {
//     const { units, fetchUnits } = useGetUnitsByProperty()
//     useEffect(() => { fetchUnits(propertyID, "ALL") }, [])
//     return (
//         <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
//             <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
//                 {units?.map((unit) => (
//                     <UnitCard
//                         key={unit.id}
//                         id={unit.code}
//                         name={unit.name}
//                         floor={unit.floor + ""}
//                         status={unit.status}
//                         tenant={{ name: "Elena Gomez", initials: "EG" }}
//                         expiry="Dic 2024"
//                         features={features}
//                         rent="$1,200.00"
//                         paymentStatus="al día" />
//                 ))}
//                 <UnitCard
//                     id="1A"
//                     name="Unidad 1-A"
//                     floor="Piso 1 • Vista Calle"
//                     status="Ocupado"
//                     tenant={{ name: "Elena Gomez", initials: "EG" }}
//                     expiry="Dic 2024"
//                     features="2 Hab • 85m²"
//                     rent="$1,200.00"
//                     paymentStatus="al día" />
//                 <UnitCard
//                     id="1B"
//                     name="Unidad 1-B"
//                     floor="Piso 1 • Interior"
//                     status="Ocupado"
//                     tenant={{ name: "Carlos Ruiz", initials: "CR" }}
//                     expiry="Ene 2025"
//                     features="1 Hab • 60m²"
//                     rent="$950.00"
//                     paymentStatus="pendiente" />
//                 <UnitCard
//                     id="2A"
//                     name="Unidad 2-A"
//                     floor="Piso 2 • Vista Calle"
//                     status="Disponible"
//                     features="2 Hab • 85m²"
//                     rent="$1,250.00"
//                     vacantDays={12} />
//             </div>
//         </div>
//     )
// }