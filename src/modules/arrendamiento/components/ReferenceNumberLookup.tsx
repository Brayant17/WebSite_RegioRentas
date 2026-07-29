import { useState } from "react";
import { checkFolio } from "../services/solicitud.service";
import type { EstadoSolicitud, ResultadoConsulta } from "../types/checkFolio.type";



const ESTADO_CONFIG: Record<EstadoSolicitud, { label: string; className: string; descripcion: string }> = {
    aprobado: {
        label: "Aprobado",
        className: "bg-green-100 text-green-700",
        descripcion: "Tu solicitud fue aprobada. Pronto nos pondremos en contacto contigo para los siguientes pasos.",
    },
    rechazado: {
        label: "Rechazado",
        className: "bg-red-100 text-red-700",
        descripcion: "Tu solicitud no fue aprobada en esta ocasión.",
    },
    pendiente: {
        label: "Pendiente",
        className: "bg-yellow-100 text-yellow-700",
        descripcion: "Tu solicitud está en revisión. Te notificaremos en cuanto haya una actualización.",
    },
};

export function ReferenceNumberLookup() {
    const [folio, setFolio] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!folio.trim()) {
            setError("Ingresa un folio para continuar.");
            return;
        }

        setError(null);
        setLoading(true);
        setResultado(null);
        // Mock temporal: simula una llamada al backend
        try{
            const data = await checkFolio(folio);
            if(data){
                setResultado(data)
            }
        }
        finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-md">
            <h1 className="text-2xl font-bold tracking-tight">
                Consultar estado de solicitud
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
                Ingresa el folio que recibiste al enviar tu solicitud de arrendamiento.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <div className="space-y-1.5">
                    <label htmlFor="folio" className="text-sm font-medium">
                        Folio
                    </label>

                    <input
                        id="folio"
                        type="text"
                        value={folio}
                        onChange={(e) => {
                            setFolio(e.target.value);
                            if (error) setError(null);
                        }}
                        placeholder="Ej. R-2026-00145"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm
                        transition-colors placeholder:text-muted-foreground
                        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
                        disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={loading}
                    />

                    {error && (
                        <p className="text-sm text-red-600">{error}</p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium
                    bg-primary text-primary-foreground shadow hover:bg-primary/90
                    h-9 px-4 py-2
                    transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
                    disabled:pointer-events-none disabled:opacity-50"
                >
                    {loading ? "Consultando..." : "Consultar estado"}
                </button>
            </form>

            {resultado && (
                <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            Folio {resultado.folio}
                        </span>

                        <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_CONFIG[resultado.estatus].className}`}
                        >
                            {ESTADO_CONFIG[resultado.estatus].label}
                        </span>
                    </div>

                    {resultado.unidad && (
                        <p className="mt-4 text-sm">
                            <span className="text-muted-foreground">Unidad: </span>
                            {`${resultado.unidad} - ${resultado.edificio}`}
                        </p>
                    )}

                    <p className="mt-4 text-sm text-muted-foreground">
                        {ESTADO_CONFIG[resultado.estatus].descripcion}
                    </p>
                </div>
            )}
        </div>
    );
}