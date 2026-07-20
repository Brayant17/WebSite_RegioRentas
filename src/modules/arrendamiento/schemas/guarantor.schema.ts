import { z } from "zod";

export const GuarantorSchema = z.object({
    firstName: z
        .string()
        .min(2, "Ingrese el nombre"),

    paternalLastName: z
        .string()
        .min(2, "Ingrese el apellido paterno"),

    maternalLastName: z
        .string()
        .min(2, "Ingrese el apellido materno"),

    email: z
        .string()
        .email("Ingrese un correo válido"),

    phone: z
        .string()
        .regex(/^\d{10}$/, "El teléfono debe tener exactamente 10 dígitos"),
});

export type GuarantorForm = z.infer<typeof GuarantorSchema>;