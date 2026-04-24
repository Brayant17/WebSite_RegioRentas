import { useEffect, useRef, useState } from "react";
import { getPropertiesPage } from "../services/property.service.js";
import type { Property } from "@/types/property.js";
import type { Filters } from "../types/filters.js";

type UsePropertiesParams = {
    filters: Filters;
    limit?: number;
};

type UsePropertiesReturn = {
    properties: Property[];
    loading: boolean;
    hasMore: boolean;
    loadRef: React.RefObject<HTMLDivElement | null>;
};

export function useProperties({
    filters,
    limit = 24,
}: UsePropertiesParams): UsePropertiesReturn {

    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);

    const loadRef = useRef<HTMLDivElement | null>(null);

    // ── 1. Re-fetch when filters change ─────────────────────────────
    useEffect(() => {
        if (!filters._initialized) return;
        setPage(0);
        setHasMore(true);
        loadPage(0);
    }, [filters]);

    // ── 2. Infinite scroll observer ─────────────────────────────────
    useEffect(() => {
        if (!filters._initialized || !hasMore || loading) return;
        if (!loadRef.current) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setPage((p) => p + 1);
            },
            { threshold: 0.1 }
        );

        observer.observe(loadRef.current);
        return () => observer.disconnect();
    }, [filters, hasMore, loading]);

    // ── 3. Fetch next page ──────────────────────────────────────────
    useEffect(() => {
        if (page === 0 || !filters._initialized) return;
        loadPage(page);
    }, [page]);

    // ── Helpers ────────────────────────────────────────────────────
    async function loadPage(currentPage: number): Promise<void> {
        setLoading(true);
        try {
            const { properties: newProperties, hasMore: more } =
                await getPropertiesPage({
                    page: currentPage,
                    limit,
                    filters,
                });

            setProperties((prev) =>
                currentPage === 0 ? newProperties : [...prev, ...newProperties]
            );
            setHasMore(more);
        } catch (err) {
            console.error("[useProperties]", err);
        } finally {
            setLoading(false);
        }
    }

    return { properties, loading, hasMore, loadRef };
}