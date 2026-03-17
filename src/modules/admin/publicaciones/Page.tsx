"use client";

import { DataTable } from "@/components/ui/DataTable/data-table";
import { columns } from "@/modules/admin/publicaciones/components/columns";
import { PropertyFilters } from "@/modules/admin/publicaciones/components/PropertyFilters";
import { CSVExportButton } from "@/components/CSVExportButton";
import { Button } from "@/components/ui/button";
import { useProperties } from "./hooks/useProperties";

export default function PropertiesPage() {
    const { properties, page, setPage, rowsPerPage, setRowsPerPage, totalPages, loading, error, filters, setFilters, loadProperties } = useProperties();

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-bold">Publicaciones</h1>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <PropertyFilters
                    onFilter={(f: any) => {
                        setPage(1);
                        setFilters(f);
                    }}
                    className="w-full md:w-auto"
                />

                <div className="flex gap-2 w-full md:w-auto flex-col md:flex-row">
                    <Button asChild variant="default" className="w-full md:w-auto">
                        <a href="/panel/publicaciones/nueva">Nueva Publicación</a>
                    </Button>
                    <CSVExportButton data={properties} fileName="Publicaciones" className="w-full md:w-auto" />
                </div>
            </div>
            <DataTable
                columns={columns}
                data={properties}
                page={page}
                setPage={setPage}
                rowsPerPage={rowsPerPage}
                setRowsPerPage={setRowsPerPage}
                totalPages={totalPages}
             />
        </div>
    );
}
