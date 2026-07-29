import { z } from "zod";
import {
    EmploymentStatus,
    EmploymentDuration,
} from "@/modules/arrendamiento/types/rental";

export const EmploymentSchema = z
    .object({
        employmentStatus: z
            .nativeEnum(EmploymentStatus)
            .nullable()
            .transform((value) => value ?? undefined)
            .refine((value) => value !== undefined, {
                message: "Selecciona una situación laboral",
            }),

        company: z.string().min(2, "Ingrese el nombre de la empresa donde trabaja").optional(),

        position: z.string().min(2, "Ingrese el puesto donde trabaja").optional(),

        monthlyIncome: z.coerce.number().nonnegative().optional(),

        phoneCompany: z.string().regex(/^\d{10}$/, "El teléfono debe tener exactamente 10 dígitos").optional(),

        employmentDuration: z
            .nativeEnum(EmploymentDuration)
            .nullable()
            .optional(),

        supervisorName: z.string().min(2, "Ingrese el nombre de su jefe inmediato").optional(),
    })
    .superRefine((data, ctx) => {
        const status = data.employmentStatus as EmploymentStatus | undefined;

        if (!status) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["employmentStatus"],
                message: "Selecciona una situación laboral",
            });
            return;
        }

        switch (status) {
            case EmploymentStatus.Empleado:
                if (!data.company || data.company.trim().length < 2) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["company"],
                        message: "Ingrese el nombre de la empresa",
                    });
                }
                if (!data.position || data.position.trim().length < 2) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["position"],
                        message: "Ingrese el puesto",
                    });
                }
                if (data.monthlyIncome === undefined || data.monthlyIncome === null || data.monthlyIncome <= 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["monthlyIncome"],
                        message: "Ingrese un salario válido",
                    });
                }
                if (!data.employmentDuration) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["employmentDuration"],
                        message: "Selecciona una antigüedad laboral",
                    });
                }
                break;

            case EmploymentStatus.Independiente:
                if (!data.position || data.position.trim().length < 2) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["position"],
                        message: "Ingrese la actividad o profesión",
                    });
                }
                if (data.monthlyIncome === undefined || data.monthlyIncome === null || data.monthlyIncome <= 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["monthlyIncome"],
                        message: "Ingrese un salario válido",
                    });
                }
                if (!data.employmentDuration) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["employmentDuration"],
                        message: "Selecciona una antigüedad laboral",
                    });
                }
                break;

            case EmploymentStatus.Empresario:
                if (!data.company || data.company.trim().length < 2) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["company"],
                        message: "Ingrese el nombre de la empresa",
                    });
                }
                if (!data.position || data.position.trim().length < 2) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["position"],
                        message: "Ingrese el cargo",
                    });
                }
                if (data.monthlyIncome === undefined || data.monthlyIncome === null || data.monthlyIncome <= 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["monthlyIncome"],
                        message: "Ingrese un salario válido",
                    });
                }
                if (!data.employmentDuration) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["employmentDuration"],
                        message: "Selecciona una antigüedad laboral",
                    });
                }
                break;

            case EmploymentStatus.Pensionado:
                if (data.monthlyIncome === undefined || data.monthlyIncome === null || data.monthlyIncome <= 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["monthlyIncome"],
                        message: "Ingrese un salario válido",
                    });
                }
                break;

            case EmploymentStatus.Estudiante:
                // no requiere campos adicionales
                break;

            case EmploymentStatus.Otro:
                // ingreso opcional
                break;
        }
    });

export type EmployForm = z.infer<typeof EmploymentSchema>;
export type EmployFormInput = z.input<typeof EmploymentSchema>;
export type EmployFormOutput = z.output<typeof EmploymentSchema>;