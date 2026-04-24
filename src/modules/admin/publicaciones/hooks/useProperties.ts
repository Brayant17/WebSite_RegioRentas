import { useEffect, useState } from "react";
import type { Property } from "../types";
import { fetchProperties } from "../services/property.service";

export function useProperties() {
    // Aquí podrías usar un estado para almacenar las propiedades, filtros, paginación, etc.
    // Y también podrías usar useEffect para cargar las propiedades cuando los filtros o la página cambien.

    // Data state
    const [properties, setProperties] = useState<Property[]>([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Table state
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [filters, setFilters] = useState<any>({ title: "", property_type: "", status: "", slug: "" });

    const limit = rowsPerPage; // registros por página

    useEffect(() => {
        loadProperties();
    }, [filters, page, rowsPerPage]);

    async function loadProperties() {
        setLoading(true);
        try {
            const { data, count } = await fetchProperties(filters, page, limit);
            setProperties(data);
            setTotalPages(Math.ceil(count / limit));
        } catch (err) {
            setError("Error al cargar las propiedades");
        } finally {
            setLoading(false);
        }
    }

    return {
        loadProperties,
        properties,
        page,
        setPage,
        rowsPerPage,
        setRowsPerPage,
        totalPages,
        loading,
        error,
        filters,
        setFilters,
    }
}