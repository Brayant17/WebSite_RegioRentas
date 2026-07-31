export interface Unit {
    edificio_id?: string;
    nombre: string;
    numero?: string;
    piso: string;
    tipo: "Departamento" | "Penthouse" | "Loft";
    recamaras: string;
    area: string;
    ubicacion: string;
    precio_renta: string;
    estatus: string;
}