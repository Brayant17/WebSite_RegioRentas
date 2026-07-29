"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ArrendamientoFilters = {
    search: string;
    status: string;
    propertyType: string;
};

export function ArrendamientoFilters({
    onFilter,
}: {
    onFilter: (filters: ArrendamientoFilters) => void;
}) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [propertyType, setPropertyType] = useState("");

    const handleFilterChange = (nextFilters: ArrendamientoFilters) => {
        setSearch(nextFilters.search);
        setStatus(nextFilters.status);
        setPropertyType(nextFilters.propertyType);
        onFilter(nextFilters);
    };

    const clearFilters = () => {
        handleFilterChange({ search: "", status: "", propertyType: "" });
    };

    return (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/80 p-4 shadow-sm md:flex-row md:items-end md:justify-between">
            <div className="grid w-full gap-4 md:grid-cols-3">
                <div className="space-y-2">
                    <Label htmlFor="arrendamiento-search">Buscar</Label>
                    <Input
                        id="arrendamiento-search"
                        placeholder="Folio, solicitante, email, unidad..."
                        value={search}
                        onChange={(event) => {
                            handleFilterChange({
                                search: event.target.value,
                                status,
                                propertyType,
                            });
                        }}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="arrendamiento-status">Estado</Label>
                    <Select
                        value={status || "all"}
                        onValueChange={(value) => {
                            handleFilterChange({
                                search,
                                status: value === "all" ? "" : value,
                                propertyType,
                            });
                        }}
                    >
                        <SelectTrigger id="arrendamiento-status" className="w-full">
                            <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="Pendiente">Pendiente</SelectItem>
                            <SelectItem value="Aprobada">Aprobada</SelectItem>
                            <SelectItem value="Rechazada">Rechazada</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="arrendamiento-property-type">Tipo de inmueble</Label>
                    <Select
                        value={propertyType || "all"}
                        onValueChange={(value) => {
                            handleFilterChange({
                                search,
                                status,
                                propertyType: value === "all" ? "" : value,
                            });
                        }}
                    >
                        <SelectTrigger id="arrendamiento-property-type" className="w-full">
                            <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent side="bottom">
                            <SelectItem value="all">Todas</SelectItem>
                            <SelectItem value="Departamento">Departamento</SelectItem>
                            <SelectItem value="Casa">Casa</SelectItem>
                            <SelectItem value="Local">Local</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex w-full justify-end md:w-auto">
                <Button variant="outline" onClick={clearFilters} className="w-full md:w-auto">
                    Limpiar filtros
                </Button>
            </div>
        </div>
    );
}
