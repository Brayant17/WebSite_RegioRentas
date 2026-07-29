export const RENTAL_DOCUMENTS = [
    {
        name: "officialId",
        label: "Identificación oficial",
        description: "INE, pasaporte o identificación vigente",
        required: true,
    },
    {
        name: "proofOfAddress",
        label: "Comprobante de domicilio",
        description: "Recibo de agua, luz, gas o teléfono",
        required: true,
    },
    {
        name: "proofOfIncome",
        label: "Comprobantes de ingresos",
        description: "Recibos de nómina o estados de ingresos",
        required: true,
    },
    {
        name: "taxCertificate",
        label: "Constancia de situación fiscal",
        description: "Cuando aplique",
        required: false,
    },
    {
        name: "bankStatements",
        label: "Estados de cuenta",
        description: "Cuando sean solicitados",
        required: false,
    },
    {
        name: "guarantorOfficialId",
        label: "Identificación oficial del fiador",
        description: "Documento del obligado solidario",
        required: false,
        isGuarantorDocument: true,
    },
    {
        name: "guarantorProofOfAddress",
        label: "Comprobante de domicilio del fiador",
        description: "Documento del obligado solidario",
        required: false,
        isGuarantorDocument: true,
    },
] as const;