import { z } from "zod";

const requiredFileSchema = z.instanceof(File, {
  message: "Este documento es obligatorio.",
});

const optionalFileSchema = z.instanceof(File).optional();

export const DocumentsSchema = z.object({

    officialId: requiredFileSchema,

    proofOfAddress: requiredFileSchema,

    proofOfIncome: requiredFileSchema,

    taxCertificate: optionalFileSchema,

    bankStatements: optionalFileSchema,

    guarantorOfficialId: optionalFileSchema,

    guarantorProofOfAddress: optionalFileSchema,

});

export type DocumentsForm = z.infer<typeof DocumentsSchema>;