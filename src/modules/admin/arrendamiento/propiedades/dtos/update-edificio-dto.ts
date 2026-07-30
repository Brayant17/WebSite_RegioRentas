export type UpdateEdificioDTO = {
    id: string;
    type: string;
    nombre: string;
    direccion: string;
    ciudad: string;
    estado: string;
    codigo_postal: string;
    estatus: "activo" | "inactivo";
};