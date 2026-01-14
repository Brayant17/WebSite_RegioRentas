// src/modules/realEstateBI/ui/components/aside/BuildingCard.tsx

import { IconBuildings } from '@tabler/icons-react';
import { DoorClosed, Percent } from 'lucide-react';

interface BuildingCardProps {
    building: Building;
    isActive?: boolean;
    selected?: boolean; // Prop utilizada para resaltar la selección
    setSelectedProperty: (id: string | null) => void;
}

export interface Building {
    id?: string;
    name: string;
    address: string;
    units?: number;
    occupancy?: number;
    active?: boolean;
    type?: 'Residencial' | 'Comercial';
}

export default function BuildingCard({ building, isActive, selected, setSelectedProperty }: BuildingCardProps) {
    return (
        <div
            onClick={() => setSelectedProperty(building.id || null)}
            className={`group flex items-start gap-3 p-3 rounded-xl border cursor-pointer relative overflow-hidden transition-all duration-200 
                ${/* Lógica de sombreado al pasar el mouse (Hover) */ ''}
                hover:shadow-md hover:-translate-y-0.5
                
                ${/* Lógica de Selección vs Estado Normal */ ''}
                ${selected 
                    ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-500 shadow-sm ring-1 ring-blue-500/20' 
                    : isActive 
                        ? 'bg-primary/5 border-primary/30' 
                        : 'bg-white dark:bg-[#1a2634] border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:bg-[#232e3c]'
                }`}
        >
            {/* Indicador lateral si está activo */}
            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
            
            {/* Indicador visual extra si está seleccionado (opcional, una pequeña marca azul) */}
            {selected && <div className="absolute right-2 top-2 size-2 rounded-full bg-blue-500"></div>}

            <div className={`flex size-12 shrink-0 items-center justify-center rounded-lg shadow-sm border transition-colors
                ${selected || isActive
                    ? 'bg-white dark:bg-[#111827] text-primary border-primary/10'
                    : 'bg-[#f0f4f8] dark:bg-[#111827] text-[#617589] dark:text-[#9ca3af] border-transparent'
                }`}>
                <span className="material-symbols-outlined">
                    <IconBuildings size={20} stroke={1.5} />
                </span>
            </div>

            <div className="flex flex-col flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <span className={`font-bold truncate pr-2 transition-colors ${
                        selected ? 'text-blue-600 dark:text-blue-400' : 'text-[#111418] dark:text-white'
                    }`}>
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
                        <DoorClosed size={14} />
                        {building.units} Unidades
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[#617589] dark:text-[#9ca3af]">
                        <Percent size={14} />
                        {building.occupancy}% Ocupación
                    </div>
                </div>
            </div>
        </div>
    );
}