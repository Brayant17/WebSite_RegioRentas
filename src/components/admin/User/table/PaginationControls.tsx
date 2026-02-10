"use client";

import { Button } from "@/components/ui/button";

interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function PaginationControls({
    page,
    totalPages,
    onPageChange,
}: PaginationProps) {
    if (totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);

    return (
        <div className="flex items-center justify-center gap-2 py-4">

            {/* Botón Anterior */}
            <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => onPageChange(page - 1)}
            >
                Anterior
            </Button>

            {/* Números de página */}
            {pages.map((p) => (
                <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    onClick={() => onPageChange(p)}
                >
                    {p}
                </Button>
            ))}

            {/* Botón Siguiente */}
            <Button
                variant="outline"
                disabled={page === totalPages}
                onClick={() => onPageChange(page + 1)}
            >
                Siguiente
            </Button>
        </div>
    );
}
