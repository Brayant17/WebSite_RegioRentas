import { z } from "zod";

export const PersonalSchema = z.object({

    firstName: z
        .string()
        .min(2, "Ingrese su nombre"),

    paternalLastName: z
        .string()
        .min(2, "Ingrese su apellido paterno"),

    maternalLastName: z
        .string()
        .min(2, "Ingrese su apellido materno"),

    email: z
        .string()
        .email("Correo inválido"),

    phone: z
        .string()
        .regex(/^\d{10}$/, "El teléfono debe tener exactamente 10 dígitos"),

    address: z
        .string()
        .min(5, "Ingrese la direccion de origen")

});

export type PersonalForm = z.infer<typeof PersonalSchema>;