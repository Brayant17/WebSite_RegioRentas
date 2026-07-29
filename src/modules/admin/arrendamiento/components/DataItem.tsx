// Fila reutilizable "etiqueta + valor", sin caja de icono
export function DataItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
    return (
        <div className={wide ? "sm:col-span-2" : undefined}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-sm font-medium leading-snug break-words">{value}</p>
        </div>
    );
}