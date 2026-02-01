"use client";

import { Button } from "@/components/ui/button";

export function CSVExportButton({ data, className }: { data: any[], className: string }) {
    const exportCSV = () => {
        if (!data || data.length === 0) return;

        // Convertir a CSV
        const headers = Object.keys(data[0]).join(",");
        const rows = data
            .map((row) =>
                Object.values(row)
                    .map((value) => `"${value ?? ""}"`)
                    .join(",")
            )
            .join("\n");

        const csvContent = [headers, rows].join("\n");

        // Crear archivo descargable
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        // Forzar descarga
        const link = document.createElement("a");
        link.href = url;
        link.download = "usuarios.csv";
        link.click();

        URL.revokeObjectURL(url);
    };

    return (
        <Button onClick={exportCSV} variant="outline" className={className}>
            Exportar CSV
        </Button>
    );
}
