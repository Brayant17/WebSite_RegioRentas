// infrastructure/dtos/UnitRecordDto.ts
export interface UnitRecordDto {
    id: string;
    rental_property_id: string;
    codigo: string;
    nombre: string;
    tipo: string;
    piso: number | null;
    area_m2: number | null;
    recamaras: number | null;
    banos: number | null;
    estacionamientos: number | null;
    estado: string;
    precio_renta: number;
    precio_venta: number | null;
    moneda: string;
    descripcion: string | null;
    amueblado: boolean;
    activo: boolean;
    created_at: string;
    updated_at: string;
}
