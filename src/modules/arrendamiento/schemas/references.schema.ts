import { z } from "zod";

const ReferenceSchema = z.object({
    fullName: z.string().min(2, "Ingrese el nombre"),
    phone: z.string().regex(/^\d{10}$/, "El teléfono debe tener 10 dígitos"),
    relationship: z.string().min(2, "Ingrese la relación"),
});

export const ReferencesSchema = z.object({
    references: z
        .array(ReferenceSchema)
        .length(2, "Debe ingresar exactamente dos referencias"),
});

export type ReferencesForm = z.infer<typeof ReferencesSchema>;