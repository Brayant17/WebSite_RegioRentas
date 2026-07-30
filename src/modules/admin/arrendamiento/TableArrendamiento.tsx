"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrendamientoFilters, type ArrendamientoFilters as FiltersType } from "./components/ArrendamientoFilters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import RequestDetailsModal from "./components/RequestDetailsModal";
import { ChangeStatus, getListApplication } from "./services/solicitudes.service";
import type { SolicitudArrendamiento } from "./types/Solicitud.type";


const formatDate = (value: string) => {
    const date = new Date(value);
    return new Intl.DateTimeFormat("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
};

const statusVariant = (status: SolicitudArrendamiento["status"]) => {
    switch (status) {
        case "aprobada":
            return "outline";
        case "rechazada":
            return "destructive";
        default:
            return "secondary";
    }
};

const statusLabel = {
    pendiente: "Pendiente",
    aprobada: "Aprobada",
    rechazada: "Rechazada",
};

export default function TableArrendamiento() {

    const [solicitudesData, setSolicitudesData] = useState<SolicitudArrendamiento[]>([]);

    useEffect(() => {
        const fetchApplication = async () => {
            try {
                const applications = await getListApplication();
                setSolicitudesData(applications);
            } catch (error) {
                console.error(error);
            }
        };

        fetchApplication();
    }, []);


    const [filters, setFilters] = useState<FiltersType>({ search: "", status: "", propertyType: "" });
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [selected, setSelected] = useState<SolicitudArrendamiento | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const filteredSolicitudes = useMemo(() => {
        return solicitudesData.filter((item) => {
            const searchValue = filters.search.trim().toLowerCase();

            const matchesSearch =
                !searchValue ||
                item.folio.toLowerCase().includes(searchValue) ||
                item.applicantName.toLowerCase().includes(searchValue) ||
                item.email.toLowerCase().includes(searchValue) ||
                item.property.toLowerCase().includes(searchValue) ||
                item.unit.toLowerCase().includes(searchValue);

            const matchesStatus =
                !filters.status || item.status === filters.status;

            const matchesPropertyType =
                !filters.propertyType || item.propertyType === filters.propertyType;

            return matchesSearch && matchesStatus && matchesPropertyType;
        });
    }, [solicitudesData, filters]);

    const totalPages = Math.max(1, Math.ceil(filteredSolicitudes.length / rowsPerPage));
    const visibleSolicitudes = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return filteredSolicitudes.slice(start, start + rowsPerPage);
    }, [filteredSolicitudes, page, rowsPerPage]);

    const handleFilter = (nextFilters: FiltersType) => {
        setFilters(nextFilters);
        setPage(1);
    };

    const handleUpdateStatus = async (id: string, newStatus: SolicitudArrendamiento["status"]) => {
        // Aqui tenemos que poner si es rechazada o aprobada
        try {
            await ChangeStatus(id, newStatus);

            setSolicitudesData((prev) =>
                prev.map((it) =>
                    it.id === id
                        ? { ...it, status: newStatus }
                        : it
                )
            );
        } catch (error) {
            console.error("Error actualizando el estado:", error);
        }
        finally{
            setModalOpen(false);
        }
    };

    return (
        <div className="space-y-6">
            <ArrendamientoFilters onFilter={handleFilter} />

            <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">Solicitudes de arrendamiento</h2>
                        <p className="text-sm text-muted-foreground">
                            {filteredSolicitudes.length} resultado{filteredSolicitudes.length === 1 ? "" : "s"}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="text-sm text-muted-foreground">
                            Página {page} de {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="rows-per-page" className="text-sm font-medium">
                                Filas:
                            </label>
                            <select
                                id="rows-per-page"
                                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={rowsPerPage}
                                onChange={(event) => {
                                    setRowsPerPage(Number(event.target.value));
                                    setPage(1);
                                }}
                            >
                                {[5, 10, 15].map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table className="w-full text-sm">
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead>Folio</TableHead>
                                <TableHead>Solicitante</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Propiedad</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleSolicitudes.map((solicitud) => (
                                <TableRow key={solicitud.id} className="hover:bg-muted/30 transition">
                                    <TableCell>{solicitud.folio}</TableCell>
                                    <TableCell>{solicitud.applicantName}</TableCell>
                                    <TableCell>{solicitud.email}</TableCell>
                                    <TableCell>
                                        {solicitud.property}
                                        <div className="text-xs text-muted-foreground">{solicitud.unit}</div>
                                    </TableCell>
                                    <TableCell>{solicitud.propertyType}</TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariant(solicitud.status)}>
                                            {statusLabel[solicitud.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{formatDate(solicitud.date)}</TableCell>
                                    <TableCell>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setSelected(solicitud);
                                                setModalOpen(true);
                                            }}
                                        >
                                            Ver
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}

                            {!visibleSolicitudes.length && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        No hay solicitudes que coincidan con los filtros.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                        Mostrando {visibleSolicitudes.length} de {filteredSolicitudes.length} solicitudes
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <div className="rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                            Página {page} de {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === 1}
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === totalPages}
                                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            <RequestDetailsModal
                open={modalOpen}
                solicitud={selected}
                onClose={() => setModalOpen(false)}
                onUpdateStatus={(id, status) => handleUpdateStatus(id, status)}
            />
        </div>
    );
}
