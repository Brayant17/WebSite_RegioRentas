"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/admin/Publicaciones/data-table";
import { columns } from "@/components/admin/Publicaciones/columns";
import { PropertyFilters } from "@/components/admin/Publicaciones/PropertyFilters";
import { CSVExportButton } from "@/components/admin/Publicaciones/CSVExportButton";
import { PaginationControls } from "@/components/admin/Publicaciones/PaginationControls";

export default function PropertiesPage() {
    const [properties, setProperties] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        title: "",
        property_type: "",
        status: "",
        slug: ""
    });

    const [page, setPage] = useState(1);

    const limit = 10;
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        loadProperties();
    }, [filters, page]);

    async function loadProperties() {
        let query = supabase
            .from("properties")
            .select("*", { count: "exact" });

        // filtros opcionales (cámbialos según tus columnas)
        if (filters.title) query = query.ilike("title", `%${filters.title}%`);
        if (filters.slug) query = query.ilike("slug", `%${filters.slug}%`);
        if (filters.property_type) query = query.eq("property_type", filters.property_type);
        if (filters.status) query = query.eq("status", filters.status);


        const start = (page - 1) * limit;
        const end = start + limit - 1;

        const { data, count, error } = await query.range(start, end);

        if (error) {
            console.error("Error al cargar publicaciones:", error);
            return;
        }

        setProperties(data);
        setTotalPages(Math.ceil(count! / limit));
    }

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

                <CSVExportButton data={properties} className="w-full md:w-auto" />
            </div>

            <div className="rounded-md border w-full overflow-x-auto">
                <DataTable columns={columns} data={properties} />
            </div>

            <PaginationControls
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
            />
        </div>
    );
}
