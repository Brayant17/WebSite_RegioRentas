import { z } from "zod";
import {
    EmploymentStatus,
    EmploymentDuration,
} from "@/modules/arrendamiento/types/rental";

export const EmploymentSchema = z.object({
    company: z
        .string()
        .min(2, "Ingrese el nombre de la empresa donde trabaja"),

    position: z
        .string()
        .min(2, "Ingrese el puesto donde trabaja"),

    monthlyIncome: z.coerce
        .number()
        .positive("Ingrese un salario válido"),

    phoneCompany: z
        .string()
        .regex(/^\d{10}$/, "El teléfono debe tener exactamente 10 dígitos"),

    employmentStatus: z
        .nativeEnum(EmploymentStatus)
        .nullable()
        .transform((value) => value ?? undefined)
        .refine((value) => value !== undefined, {
            message: "Selecciona una situación laboral",
        }),

    employmentDuration: z
        .nativeEnum(EmploymentDuration)
        .nullable()
        .transform((value) => value ?? undefined)
        .refine((value) => value !== undefined, {
            message: "Selecciona una antigüedad laboral",
        }),

    supervisorName: z
        .string()
        .min(2, "Ingrese el nombre de su jefe inmediato")
        .optional(),
});

export type EmployForm = z.infer<typeof EmploymentSchema>;
export type EmployFormInput = z.input<typeof EmploymentSchema>;
export type EmployFormOutput = z.output<typeof EmploymentSchema>;