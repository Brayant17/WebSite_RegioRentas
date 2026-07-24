import { z } from "zod";
import {
    HasGuarantor,
    Relationship,
} from "@/modules/arrendamiento/types/rental";

export const GuarantorSchema = z.object({
    hasGuarantor: z
        .nativeEnum(HasGuarantor)
        .nullable()
        .transform((value) => value ?? undefined)
        .refine((value) => value !== undefined, {
            message: "Selecciona si cuentas con fiador",
        }),

    firstName: z.string().optional(),

    paternalLastName: z.string().optional(),

    maternalLastName: z.string().optional(),

    email: z.string().optional(),

    phone: z.string().optional(),

    relationship: z
        .nativeEnum(Relationship)
        .nullable()
        .optional(),
}).superRefine((data, ctx) => {
    if (data.hasGuarantor === HasGuarantor.Si) {
        if (!data.firstName || data.firstName.trim().length < 2) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["firstName"],
                message: "Ingrese el nombre del fiador",
            });
        }

        if (!data.paternalLastName || data.paternalLastName.trim().length < 2) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["paternalLastName"],
                message: "Ingrese el apellido paterno del fiador",
            });
        }

        if (!data.maternalLastName || data.maternalLastName.trim().length < 2) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["maternalLastName"],
                message: "Ingrese el apellido materno del fiador",
            });
        }

        if (!data.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["email"],
                message: "Ingrese un correo válido del fiador",
            });
        }

        if (!data.phone || !/^\d{10}$/.test(data.phone)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["phone"],
                message: "El teléfono del fiador debe tener 10 dígitos",
            });
        }

        if (!data.relationship) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["relationship"],
                message: "Selecciona el parentesco del fiador",
            });
        }
    }
});

export type GuarantorForm = z.infer<typeof GuarantorSchema>;
export type GuarantorFormInput = z.input<typeof GuarantorSchema>;
export type GuarantorFormOutput = z.output<typeof GuarantorSchema>;