export interface Edificio {
    id: string;
    type: string;
    nombre: string;
    direccion?: string;
    ciudad?: string;
    estado?: string;
    codigo_postal?: string;
    estatus: string;
    created_at: string;
    updated_at?: string;
    total_unidades: number;
}

export interface Unidad {
    id: number;
    status: "Disponible" | "Ocupado";
    payment?: string;
}