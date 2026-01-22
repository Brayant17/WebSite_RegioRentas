// BuildingDetails.tsx
import { motion } from 'framer-motion';
import UnitCard from './unit/UnitCard';
import {
    MapPin,
    Edit3,
    Plus,
    Search,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { PropertyDTO } from '@/modules/realEstateBI/application/dtos/PropertyDTO';
import EditPropertyDialog from './EditPropertyDialog';
import UnitCreateDialog from './unit/UnitCreateDialog';
import { useState } from 'react';
import BuildingUnits from './unit/BuildingUnits';

//ocupado, disponible, mantenimiento seran calculados en base a las unidades de la propiedad

// --- Componente Principal ---
export default function BuildingDetails({ property, onPropertyUpdate }: { property: PropertyDTO, onPropertyUpdate: () => void }) {
    
    const [open, setOpen] = useState(false);
    const [openCreateUnit, setOpenCreateUnit] = useState(false);

    return (
        <section className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#111827] overflow-hidden relative">
            {/* crear un modal */}
            <EditPropertyDialog open={open} onOpenChange={setOpen} property={property} onSaved={onPropertyUpdate} />
            <UnitCreateDialog open={openCreateUnit} onOpenChange={setOpenCreateUnit} propertyID={property.id} />
            <header className="bg-white dark:bg-[#1a2634] border-b border-slate-200 dark:border-slate-800 px-6 py-5 shrink-0 z-10 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="size-14 rounded-xl bg-primary text-white flex items-center justify-center shadow-md shrink-0">
                            <span className="text-xl font-black tracking-tighter">TP</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-black text-slate-900 dark:text-white">{property?.name}</h1>
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">Residencial</Badge>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-1 mt-1">
                                <MapPin size={14} /> {property?.address}
                            </p>
                            <div className="flex items-center gap-4 mt-3 text-sm">
                                <div className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-green-500"></span>
                                    <span className="text-slate-700 dark:text-slate-200 font-medium text-xs">22 Ocupados</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                    <span className="text-slate-700 dark:text-slate-200 font-medium text-xs">2 Disponibles</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-yellow-400"></span>
                                    <span className="text-slate-700 dark:text-slate-200 font-medium text-xs">0 Mantenimiento</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" size="sm" className="gap-2 cursor-pointer" onClick={() => setOpen(true)}>
                            <Edit3 size={16} /> Editar
                        </Button>
                        <Button size="sm" className="gap-2 bg-primary" onClick={() => setOpenCreateUnit(true)}>
                            <Plus size={16} /> Nueva Unidad
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 mt-6 items-center justify-between">
                    <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                        <span className="text-sm font-semibold text-slate-500 mr-2">Filtrar:</span>
                        <Button size="sm" variant="default" className="h-8 rounded-lg">Todas</Button>
                        <Button size="sm" variant="ghost" className="h-8 rounded-lg text-slate-500">Disponibles</Button>
                        <Button size="sm" variant="ghost" className="h-8 rounded-lg text-slate-500">Ocupadas</Button>
                        <Button size="sm" variant="ghost" className="h-8 rounded-lg text-slate-500">Morosos</Button>
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input
                            className="pl-9 h-9 bg-slate-50 dark:bg-[#111827]"
                            placeholder="Buscar unidad o inquilino..."
                        />
                    </div>
                </div>
            </header>

            <BuildingUnits propertyID={property.id} />
        </section>
    );
}