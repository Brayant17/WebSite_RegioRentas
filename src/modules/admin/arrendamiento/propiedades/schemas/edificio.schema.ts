import { z } from "zod";

export const edificioSchema = z.object({
  tipo: z.string().min(1, "Selecciona un tipo de edificio"),
  nombre: z.string().min(1, "El nombre es obligatorio"),
  direccion: z.string().min(1, "La dirección es obligatoria"),
  ciudad: z.string().min(1, "La ciudad es obligatoria"),
  estado: z.string().min(1, "El estado es obligatorio"),
  codigo_postal: z
    .string()
    .regex(/^[0-9]{5}$/, "Código postal inválido"),
  estatus: z.enum(["activo", "inactivo"]),
});

export type EdificioForm = z.infer<typeof edificioSchema>;