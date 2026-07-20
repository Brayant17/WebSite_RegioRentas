import { z } from "zod";

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

    supervisorName: z
        .string()
        .min(2, "Ingrese el nombre de su jefe inmediato")
        .optional(),

    phoneCompany: z
        .string()
        .regex(/^\d{10}$/, "El teléfono debe tener exactamente 10 dígitos"),
});

export type EmployForm = z.infer<typeof EmploymentSchema>;