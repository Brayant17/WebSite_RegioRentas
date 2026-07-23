import { useRentalStore } from "../../stores/rentalStore";

interface Props {
    unit: any;
    onStart: () => void;
}

export default function Welcome({ unit, onStart, }: Props) {
    return (
        <section className="mx-auto max-w-3xl py-10">
            <div className="rounded-xl border bg-card p-8 shadow-sm">
                <span className="text-sm text-muted-foreground">
                    Solicitud de arrendamiento
                </span>
                <h1 className="mt-2 text-3xl font-bold">
                    {unit.nombre}
                </h1>
                <p className="mt-1 text-muted-foreground">
                    {unit.edificio}
                </p>
                <div className="mt-6 rounded-lg bg-muted p-5">
                    <h2 className="font-semibold">
                        Información de la unidad
                    </h2>
                    <div className="mt-4 space-y-2">
                        <div className="flex justify-between">
                            <span>Dirección</span>
                            <span>{unit.direccion}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Renta mensual</span>
                            <span className="font-semibold">
                                {new Intl.NumberFormat("es-MX", {
                                    style: "currency",
                                    currency: "MXN",
                                    maximumFractionDigits: 0,
                                }).format(unit.precio_renta)}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="mt-8">
                    <h2 className="font-semibold">
                        Antes de comenzar necesitarás:
                    </h2>
                    <ul className="mt-4 space-y-2 text-sm">
                        <li>✅ Identificación oficial vigente</li>
                        <li>✅ Comprobante de ingresos</li>
                        <li>✅ Comprobante de domicilio</li>
                        <li>✅ Referencias personales</li>
                    </ul>
                </div>
                <div className="mt-8 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm">
                    El proceso toma aproximadamente <strong>10 minutos</strong>.
                </div>
                <button
                    onClick={onStart}
                    className="mt-8 w-full rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground hover:bg-primary/90"
                >
                    Comenzar solicitud
                </button>
            </div>
        </section>
    );
}