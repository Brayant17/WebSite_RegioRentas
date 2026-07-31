import { z } from "zod";

export const unidadSchema = z.object({
    nombre: z
        .string()
        .min(1, "El nombre es obligatorio"),

    numero: z
        .string()
        .min(1, "El número de unidad es obligatorio"),

    piso: z
        .coerce.number()
        .min(0, "El piso debe ser válido"),

    tipo: z.enum([
        "Departamento",
        "Loft",
        "Penthouse",
        "Estudio",
    ]),

    recamaras: z
        .coerce.number()
        .min(0, "El número de recámaras debe ser válido"),

    area: z
        .coerce.number()
        .positive("El área debe ser mayor a 0"),

    ubicacion: z
        .string()
        .min(1, "La ubicación es obligatoria"),

    precio_renta: z
        .coerce.number()
        .positive("El precio de renta debe ser mayor a 0"),
});

export type UnidadForm = z.infer<typeof unidadSchema>;
