import React, { useState, useMemo, useEffect } from "react";
import {
    Search,
    Pencil,
    Plus,
    MapPin,
    DoorOpen,
    Percent,
    Map as MapIcon,
} from "lucide-react";

import { Toaster } from "@/components/ui/sonner"

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ---------------------------------------------------------------------
   Data — sin cambios, se refactorizan en un paso posterior
--------------------------------------------------------------------- */
import { icon } from "@/modules/admin/arrendamiento/propiedades/mocks/propiedades";
import { BuildingStatusPill } from "./components/BuildingStatusPill";
import { UnitCard } from "./components/UnitCard";
import type { Edificio } from "../types/edificios.type";
import { getUnitsByBuilding } from "./services/propiedades.service";
import { EdificioDialog } from "./components/EdificioDialog";
import type { UnitDTO } from "./dtos/create-unitUI-dto";

const unitFilters = ["Todas", "Disponibles", "Ocupadas", "Morosos"] as const;
const sidebarFilters = ["Todos", "Residencial", "Comercial"] as const;

/* ---------------------------------------------------------------------
   Main app
--------------------------------------------------------------------- */
export default function PropiedadesArrendamiento({ initialEdificios }: { initialEdificios: Edificio[] }) {
    const [edificios, setEdificios] = useState(initialEdificios);
    const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(initialEdificios[0]?.id ?? null);
    const [selectedEdificioModal, setSelectedEdifcioModal] = useState<Edificio | null>(null)
    const [sidebarFilter, setSidebarFilter] = useState<(typeof sidebarFilters)[number]>("Todos");
    const [sidebarSearch, setSidebarSearch] = useState("");
    const [unitFilter, setUnitFilter] = useState<(typeof unitFilters)[number]>("Todas");
    const [unitSearch, setUnitSearch] = useState("");
    const [units, setUnits] = useState<UnitDTO[]>([])
    // Dialogs
    const [openEdificio, setOpenEdificio] = useState(false);
    const [mode, setMode] = useState<"create" | "edit">("create")

    // handles Edificio
    const handleCreateEdificio = () => {
        setSelectedEdifcioModal(null)
        setMode("create")
        setOpenEdificio(true);
    }

    const handleEditEdificio = () => {
        const edificioSelecionado = edificios.find(edificio => edificio.id === selectedBuildingId) ?? null;
        setSelectedEdifcioModal(edificioSelecionado);
        setMode("edit")
        setOpenEdificio(true);
    }

    const selectedBuilding = edificios.find((b) => b.id === selectedBuildingId);
    // const units = unitsByBuilding[selectedBuildingId] || [];

    useEffect(() => {
        if (selectedBuildingId === null) {
            setUnits([]);
            return;
        }
        const fetchUnidades = async () => {
            const unidades = await getUnitsByBuilding(selectedBuildingId);
            setUnits(unidades);
        }
        fetchUnidades()
    }, [selectedBuildingId])

    const filteredBuildings = useMemo(() => {
        return edificios.filter((b) => {
            const matchesType = sidebarFilter === "Todos" || b.type === sidebarFilter;
            const matchesSearch = b.nombre.toLowerCase().includes(sidebarSearch.toLowerCase());
            return matchesType && matchesSearch;
        });
    }, [edificios, sidebarFilter, sidebarSearch]);

    const filteredUnits = useMemo(() => {
        return units.filter((u) => {
            let matchesFilter = true;
            if (unitFilter === "Disponibles") matchesFilter = u.status === "Disponible";
            if (unitFilter === "Ocupadas") matchesFilter = u.status === "Ocupado";
            // if (unitFilter === "Morosos") matchesFilter = u.payment === "pendiente";

            const search = unitSearch.toLowerCase();
            // const matchesSearch =
            //     !search ||
            //     u.name.toLowerCase().includes(search) ||
            //     (u.tenant && u.tenant.toLowerCase().includes(search));

            // return matchesFilter && matchesSearch;
            return matchesFilter;
        });
    }, [units, unitFilter, unitSearch]);

    // const occupiedCount = units.filter((u) => u.status === "Ocupado").length;
    // const availableCount = units.filter((u) => u.status === "Disponible").length;
    const maintenanceCount = 0;

    if (!selectedBuilding) return null;

    return (
        <>
            <Toaster />
            <div className="flex min-h-screen flex-col bg-muted/30 text-foreground">
                <EdificioDialog
                    open={openEdificio}
                    onOpenChange={setOpenEdificio}
                    mode={mode}
                    edificio={selectedEdificioModal}
                    onSuccess={(edificio) => {
                        setEdificios(prev => {
                            const existe = prev.some(e => e.id === edificio.id);
                            if (existe) {
                                return prev.map(e =>
                                    e.id === edificio.id ? edificio : e
                                );
                            }
                            return [...prev, edificio];
                        });
                        setSelectedBuildingId(edificio.id);
                    }}
                />
                <main className="flex w-full flex-1 justify-center">
                    <div className="flex w-full flex-col lg:flex-row">
                        {/* -------------------------------------------------- Sidebar */}
                        <aside className="z-10 flex w-full shrink-0 flex-col border-r bg-card lg:w-[340px]">
                            <div className="flex shrink-0 flex-col gap-4 border-b py-6.5 px-5">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold">Propiedades</h2>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-primary hover:bg-primary/10 hover:text-primary"
                                        title="Añadir Edificio"
                                        onClick={handleCreateEdificio}
                                    >
                                        <Plus className="size-5" />
                                    </Button>
                                </div>

                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={sidebarSearch}
                                        onChange={(e) => setSidebarSearch(e.target.value)}
                                        placeholder="Buscar edificio..."
                                        className="h-10 bg-background pl-9"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    {sidebarFilters.map((f) => {
                                        const active = sidebarFilter === f;
                                        return (
                                            <Button
                                                key={f}
                                                size="sm"
                                                variant={active ? "default" : "outline"}
                                                onClick={() => setSidebarFilter(f)}
                                                className={cn(
                                                    "h-7 rounded-full px-3 text-xs font-semibold",
                                                    !active && "text-muted-foreground"
                                                )}
                                            >
                                                {f}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* <ScrollArea className="flex-1 w-full"> */}
                            <div className="flex flex-col gap-2 p-3">
                                {filteredBuildings.map((b) => {
                                    const Icon = icon.Departamentos;
                                    const active = b.id === selectedBuildingId;
                                    return (
                                        <div
                                            key={b.id}
                                            onClick={() => setSelectedBuildingId(b.id)}
                                            className={cn(
                                                "relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all",
                                                active
                                                    ? "border-primary/30 bg-primary/5 shadow-sm"
                                                    : "border-transparent bg-card hover:border-border hover:bg-muted/50"
                                            )}
                                        >
                                            {active && (
                                                <span className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-primary" />
                                            )}
                                            <div
                                                className={cn(
                                                    "flex size-12 shrink-0 items-center justify-center rounded-lg",
                                                    active
                                                        ? "border border-primary/10 bg-background text-primary shadow-sm"
                                                        : "bg-muted text-muted-foreground"
                                                )}
                                            >
                                                <Icon className="size-5" />
                                            </div>
                                            <div className="flex min-w-0 flex-1 flex-col">
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="truncate font-bold">{b.nombre}</span>
                                                    <BuildingStatusPill status={b.estatus} />
                                                </div>
                                                <span className="truncate text-xs text-muted-foreground">
                                                    {`${b.direccion ?? ''} ${b.ciudad ?? ''} ${b.estado ?? ''}`}
                                                </span>
                                                <div className="mt-2 flex items-center gap-3">
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <DoorOpen className="size-3.5" />
                                                        {b.total_unidades} Unidades
                                                    </div>
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <Percent className="size-3.5" />
                                                        {/* {b.occupancy}% Ocupación */}
                                                        -- Ocupación
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* </ScrollArea> */}
                        </aside>

                        {/* Content */}
                        <section className="flex min-w-0 flex-1 flex-col bg-muted/30">
                            {/* Esto es la info del Edificio */}
                            <header className="shrink-0 border-b bg-card px-6 py-5 shadow-sm">
                                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                                    <div className="flex items-start gap-4">
                                        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
                                            <span className="text-xl font-black tracking-tighter">
                                                {selectedBuilding.nombre
                                                    .split(" ")
                                                    .map((w) => w[0])
                                                    .slice(0, 2)
                                                    .join("")}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h1 className="text-2xl font-black">{selectedBuilding.nombre}</h1>
                                                <Badge
                                                    variant="secondary"
                                                    className="border border-primary/20 bg-primary/10 font-semibold text-primary hover:bg-primary/10"
                                                >
                                                    {selectedBuilding.type}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                                                <MapPin className="size-4" />
                                                {`${selectedBuilding.direccion} ${selectedBuilding.ciudad} ${selectedBuilding.estado}`}, CP {selectedBuilding.codigo_postal}
                                            </p>
                                            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="size-2 rounded-full bg-emerald-500" />
                                                    <span className="font-medium">
                                                        {/* {occupiedCount} Ocupados */}
                                                        -- Ocupados
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="size-2 rounded-full bg-muted-foreground/30" />
                                                    <span className="font-medium">
                                                        {/* {availableCount} Disponibles */}
                                                        -- Disponibles
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="size-2 rounded-full bg-amber-400" />
                                                    {/* <span className="font-medium">{maintenanceCount} Mantenimiento</span> */}
                                                    <span className="font-medium">-- Mantenimiento</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <Button variant="outline" className="gap-2" onClick={handleEditEdificio}>
                                            <Pencil className="size-4" />
                                            Editar
                                        </Button>
                                        <Button className="gap-2 font-bold shadow-md">
                                            <Plus className="size-4" />
                                            Nueva Unidad
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-col items-center justify-between gap-4 md:flex-row">
                                    <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 md:w-auto md:pb-0">
                                        <span className="mr-2 shrink-0 text-sm font-semibold text-muted-foreground">
                                            Filtrar:
                                        </span>
                                        {unitFilters.map((f) => {
                                            const active = unitFilter === f;
                                            return (
                                                <Button
                                                    disabled={true}
                                                    key={f}
                                                    size="sm"
                                                    variant={active ? "default" : "ghost"}
                                                    onClick={() => setUnitFilter(f)}
                                                    className={cn(
                                                        "shrink-0 rounded-lg text-sm font-medium",
                                                        !active && "text-muted-foreground"
                                                    )}
                                                >
                                                    {f}
                                                </Button>
                                            );
                                        })}
                                    </div>

                                    <div className="relative w-full md:w-64">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={unitSearch}
                                            onChange={(e) => setUnitSearch(e.target.value)}
                                            placeholder="Buscar unidad o inquilino..."
                                            className="h-9 bg-background pl-9"
                                        />
                                    </div>
                                </div>
                            </header>

                            <ScrollArea className="flex-1">
                                <div className="p-6">
                                    {filteredUnits.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                            {filteredUnits.map((unit) => (
                                                <UnitCard key={unit.id} unit={unit} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-24 text-center text-muted-foreground">
                                            <p className="font-medium">No hay unidades que coincidan con este filtro.</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </section>
                    </div>
                </main>
            </div>
        </>
    );
}