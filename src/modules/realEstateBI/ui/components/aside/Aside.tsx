import { useEffect, useState } from 'react';
import { motion } from "framer-motion";
import { IconBuildingPlus } from '@tabler/icons-react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import BuildingCard, { type Building } from './BuildingCard';
import BuildingCardSkeleton from './BuildingCardSkeleton';
import { CreatePropertyDialog } from './CreatePropertyDialog';
import { Button } from '@/components/ui/button';

interface AsideProps {
    open: boolean;
    onToggle: () => void;
    properties: Building[],
    loading: boolean,
    error: string | null,
    selectedProperty: string | null;
    setSelectedProperty: (id: string | null) => void;
    onPropertiesChanged: () => void
}

export default function Aside({ open, onToggle, properties, loading, error, selectedProperty, setSelectedProperty, onPropertiesChanged }: AsideProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'Todos' | 'Residencial' | 'Comercial'>('Todos');
    const [openCreatePropertyDialog, setOpenCreatePropertyDialog] = useState(false);

    // searchTerm
    const filteredProperties = properties.filter((prop) => {
        const matchesSearch = prop.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch
    });

    // Considerar filtrado y búsqueda
    // const filteredProperties = properties.filter((p) => {
    //     const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    //     const matchesFilter = filter === 'Todos' || p.type === filter;
    //     return matchesSearch && matchesFilter;
    // });

    return (
        <motion.aside
            animate={{ x: open ? 0 : -260 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="w-full lg:w-[380px] h-full flex flex-col border-r border-[#dbe0e6] dark:border-[#2a3b4d] bg-white dark:bg-[#1a2634] shrink-0 z-10 overflow-auto relative">
            {/* Header & Search */}
            <CreatePropertyDialog open={openCreatePropertyDialog} onOpenChange={setOpenCreatePropertyDialog} onCreated={onPropertiesChanged} />
            {/* BOTÓN BANDERITA */}
            <Button
                variant="secondary"
                size="icon"
                onClick={onToggle}
                className="
                    absolute top-6 -right-4
                    h-8 w-8 rounded-full shadow-md z-50
                "
            >
                {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </Button>
            <div className="p-5 border-b border-[#dbe0e6] dark:border-[#2a3b4d] flex flex-col gap-4 shrink-0">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-[#111418] dark:text-white">Propiedades</h2>
                    <button
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                        title="Añadir Edificio"
                        onClick={() => setOpenCreatePropertyDialog(true)}
                    >
                        <span className="material-symbols-outlined"><IconBuildingPlus stroke={2} /></span>
                    </button>
                </div>

                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] material-symbols-outlined text-[20px]">
                        <Search />
                    </span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-10 rounded-lg border border-[#dbe0e6] dark:border-[#4b5563] bg-background-light dark:bg-[#111827] pl-10 pr-4 text-sm text-[#111418] dark:text-white placeholder-[#9ca3af] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-shadow"
                        placeholder="Buscar edificio..."
                    />
                </div>

                {/* Filters */}
                <div className="flex gap-2">
                    {(['Todos', 'Residencial', 'Comercial'] as const).map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === cat
                                ? 'bg-[#111418] dark:bg-white text-white dark:text-[#111418]'
                                : 'bg-transparent border border-[#dbe0e6] dark:border-[#4b5563] text-[#617589] dark:text-[#9ca3af] hover:border-primary hover:text-primary'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* List Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2">
                {loading && Array.from({ length: 5 }, (_, i) => (<i key={i}><BuildingCardSkeleton /></i>))}
                {filteredProperties.map((prop) => (
                    <BuildingCard
                        key={prop.id}
                        building={prop}
                        isActive={false}
                        selected={selectedProperty === prop.id}
                        setSelectedProperty={setSelectedProperty}
                    />
                ))}
                {filteredProperties.length === 0 && (
                    <p className="text-center text-sm text-gray-500 mt-4">No se encontraron edificios.</p>
                )}
                {error && (
                    <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                        Error al cargar las propiedades
                    </div>
                )}
            </div>

            {/* Footer Button */}
            {/* <div className="p-4 border-t border-[#dbe0e6] dark:border-[#2a3b4d] bg-background-light dark:bg-[#111827]">
                <button className="w-full flex items-center justify-center gap-2 rounded-lg h-10 bg-white dark:bg-[#1a2634] border border-[#dbe0e6] dark:border-[#4b5563] text-sm font-semibold text-[#111418] dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">map</span>
                    Ver Mapa de Ubicaciones
                </button>
            </div> */}
        </motion.aside>
    );
}