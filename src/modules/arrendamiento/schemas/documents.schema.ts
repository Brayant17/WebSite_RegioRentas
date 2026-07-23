import { z } from "zod";

const fileSchema = z
    .instanceof(File)
    .nullable();


export const DocumentsSchema = z.object({

    officialId: fileSchema,

    proofOfAddress: fileSchema,

    proofOfIncome: fileSchema,

    taxCertificate: fileSchema,

    bankStatements: fileSchema,

    guarantorOfficialId: fileSchema,

    guarantorProofOfAddress: fileSchema,

});


export type DocumentsForm =
    z.infer<typeof DocumentsSchema>;