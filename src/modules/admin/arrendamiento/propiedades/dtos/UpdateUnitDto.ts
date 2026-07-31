export interface UpdateUnitDto {
    id?: number;
    edificio_id: string;
    nombre: string;
    numero: string;
    piso: number;
    tipo: string;
    recamaras: number;
    area: number;
    ubicacion: string;
    precio_renta: string;
    estatus: string;
}