// src/modules/realEstateBI/ui/components/aside/BuildingCard.tsx

import { IconBuildings } from '@tabler/icons-react';
import { DoorClosed, Percent } from 'lucide-react';

// Definición de tipos para los edificios
export interface Building {
    id?: string;
    name: string;
    address: string;
    units?: number;
    occupancy?: number;
    active?: boolean;
    type?: 'Residencial' | 'Comercial';
    // icon: string;
}

export default function BuildingCard({ building, isActive }: { building: Building; isActive?: boolean }) {
    return (
        <div
            className={`group flex items-start gap-3 p-3 rounded-xl border cursor-pointer relative overflow-hidden transition-all shadow-sm ${isActive
                ? 'bg-primary/5 border-primary/30'
                : 'bg-white dark:bg-[#1a2634] border-transparent hover:border-[#dbe0e6] hover:bg-background-light dark:hover:bg-[#232e3c]'
                }`}
        >
            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}

            <div className={`flex size-12 shrink-0 items-center justify-center rounded-lg shadow-sm border ${isActive
                ? 'bg-white dark:bg-[#111827] text-primary border-primary/10'
                : 'bg-[#f0f4f8] dark:bg-[#111827] text-[#617589] dark:text-[#9ca3af] border-transparent'
                }`}>
                <span className="material-symbols-outlined">
                    <IconBuildings size={20} stroke={1.5} />
                </span>
            </div>

            <div className="flex flex-col flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <span className="font-bold text-[#111418] dark:text-white truncate pr-2">
                        {building.name}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${building.active
                        ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
                        : 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                        {building.active ? 'Activo' : 'Mantenimiento'}
                    </span>
                </div>
                <span className="text-xs text-[#617589] dark:text-[#9ca3af] truncate">
                    {building.address}
                </span>
                <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1 text-xs text-[#617589] dark:text-[#9ca3af]">
                        <span className="material-symbols-outlined text-[14px]"><DoorClosed size={14} /></span>
                        {building.units} Unidades
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#617589] dark:text-[#9ca3af]">
                        <span className="material-symbols-outlined text-[14px]"><Percent size={14} /></span>
                        {building.occupancy}% Ocupación
                    </div>
                </div>
            </div>
        </div>
    );
}