export interface Edificio {
    id: string;
    type: string;
    nombre: string;
    direccion?: string;
    cidudad?: string;
    estado?: string;
    codigo_postal?: string;
    estatus: string;
    created_at: string;
    updated_at?: string;
}

export interface Unidad {
    id: number;
    status: "Disponible" | "Ocupado";
    payment?: string;
}