import { z } from "zod";

const fileSchema = z
    .instanceof(File)
    .nullable();

const requiredFileSchema = z.instanceof(File, {
    message: "Este documento es obligatorio.",
});

export const DocumentsSchema = z.object({

    officialId: requiredFileSchema,

    proofOfAddress: requiredFileSchema,

    proofOfIncome: requiredFileSchema,

    taxCertificate: fileSchema,

    bankStatements: fileSchema,

    guarantorOfficialId: fileSchema,

    guarantorProofOfAddress: fileSchema,

});

export type DocumentsForm =
    z.infer<typeof DocumentsSchema>;