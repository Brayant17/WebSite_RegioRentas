export type PropertyType =
    | "Departamento"
    | "Casa"
    | "Bodega"
    | "Cabaña"
    | "Terreno";

export type Filters = {
    type?: PropertyType;
    operation?: "Renta" | "Venta";
    zone?: string;
    _initialized?: boolean;
};
