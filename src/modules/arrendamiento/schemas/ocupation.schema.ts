import { z } from "zod";

export const OcupationSchema = z.object({
    ocupationDate: z
        .string()
});

export type OcupationForm = z.infer<typeof OcupationSchema>;