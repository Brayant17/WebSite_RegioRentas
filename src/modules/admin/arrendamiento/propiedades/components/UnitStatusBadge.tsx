import { C } from "@/modules/admin/arrendamiento/propiedades/constants/c"

export function UnitStatusBadge({ status }: {status: "Disponible" | "Ocupado"}) {
    if (status === "Disponible") {
        return (
            <span
                className="px-2.5 py-1 rounded-full text-xs font-bold border"
                style={{ backgroundColor: "#fff", color: C.textMuted, borderColor: C.border }}
            >
                Disponible
            </span>
        );
    }
    return (
        <span
            className="px-2.5 py-1 rounded-full text-xs font-bold border"
            style={{ backgroundColor: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}
        >
            Ocupado
        </span>
    );
}