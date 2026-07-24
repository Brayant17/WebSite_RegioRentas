import { z } from "zod";
import { Gender, martialStatus } from "@/modules/arrendamiento/types/rental"

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
        .min(5, "Ingrese la direccion de origen"),

    curp: z
        .string()
        .min(5, "Ingrese un CURP valido"),

    rfc: z
        .string()
        .min(5, "Ingrese un RFC valido"),

    gender: z
        .nativeEnum(Gender)
        .nullable()
        .transform((value) => value ?? undefined)
        .refine((value) => value !== undefined, {
            message: "Escoga un género",
        }),

    martialStatus: z
        .nativeEnum(martialStatus)
        .nullable()
        .transform((value) => value ?? undefined)
        .refine((value) => value !== undefined, {
            message: "Escoga una opcion valida"
        })

});

export type PersonalForm = z.infer<typeof PersonalSchema>;
export type PersonalFormInput = z.input<typeof PersonalSchema>;   // gender: Gender | null | undefined
export type PersonalFormOutput = z.output<typeof PersonalSchema>; // gender: Gender