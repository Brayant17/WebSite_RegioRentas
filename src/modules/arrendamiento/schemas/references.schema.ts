import { z } from "zod";
import { Relationship } from "@/modules/arrendamiento/types/rental";

const ReferenceSchema = z.object({
    fullName: z.string().min(2, "Ingrese el nombre"),
    phone: z.string().regex(/^\d{10}$/, "El teléfono debe tener 10 dígitos"),
    relationship: z
        .nativeEnum(Relationship)
        .nullable()
        .transform((value) => value ?? undefined)
        .refine((value) => value !== undefined, {
            message: "Selecciona el parentesco",
        }),
});

export const ReferencesSchema = z.object({
    references: z
        .array(ReferenceSchema)
        .length(2, "Debe ingresar exactamente dos referencias"),
});

export type ReferencesForm = z.infer<typeof ReferencesSchema>;
export type ReferencesFormInput = z.input<typeof ReferencesSchema>;
export type ReferencesFormOutput = z.output<typeof ReferencesSchema>;