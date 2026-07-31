export interface Unit{
    id: string;
    edificio_id: string;
    nombre: string;
    numero: string;
    piso: number;
    tipo: "Departamento" | "Penthouse" | "Loft";
    recamaras: number;
    area: number;
    ubicacion: string;
    precio_renta: string;
    estatus: string;
    created_at: string;
    updated_at: string;
}