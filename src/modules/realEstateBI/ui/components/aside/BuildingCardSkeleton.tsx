// src/modules/realEstateBI/ui/components/aside/BuildingCardSkeleton.tsx

import { Skeleton } from "@/components/ui/skeleton"; // Ajusta la ruta según tu proyecto

export default function BuildingCardSkeleton() {
    return (
        <div className="flex items-start gap-3 p-3 rounded-xl border border-transparent bg-white dark:bg-[#1a2634] shadow-sm">

            {/* Icono del edificio (Cuadrado 48px) */}
            <Skeleton className="size-12 shrink-0 rounded-lg" />

            <div className="flex flex-col flex-1 min-w-0 gap-2">

                {/* Cabecera: Nombre y Badge de estado */}
                <div className="flex justify-between items-start">
                    <Skeleton className="h-5 w-3/4" /> {/* Nombre del edificio */}
                    <Skeleton className="h-4 w-16 rounded-full" /> {/* Badge Activo/Mantenimiento */}
                </div>

                {/* Dirección */}
                <Skeleton className="h-3 w-1/2" />

                {/* Footer del card: Unidades y Ocupación */}
                <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                        <Skeleton className="h-3 w-12" /> {/* Unidades */}
                    </div>
                    <div className="flex items-center gap-1">
                        <Skeleton className="h-3 w-14" /> {/* Ocupación */}
                    </div>
                </div>

            </div>
        </div>
    );
}