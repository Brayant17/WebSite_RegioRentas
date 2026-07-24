export enum RentalStep {
    WELCOME = 0,
    PERSONAL = 1,
    EMPLOYMENT = 2,
    GUARANTOR = 3,
    REFERENCES = 4,
    DOCUMENTS = 5,
    OCUPATION = 6,
    SUMMARY = 7,
    SUCCESS = 8,
    ERROR = 9
}

export enum Gender {
    Hombre = "Hombre",
    Mujer = "Mujer",
    NoDefinido = "No_definido"
}

// estado civil
export enum martialStatus {
    Soltero = "Soltero",
    Casado = "Casado",
    UnionLibre = "Union_libre",
    Divorciado = "Divorciado",
    Viudo = "Viudo"
}

export enum EmploymentStatus {
    Empleado = "empleado",
    Independiente = "independiente",
    Empresario = "empresario",
    Pensionado = "pensionado",
    Estudiante = "estudiante",
    Otro = "otro",
}

export enum EmploymentDuration {
    MENOS_6_MESES = "MENOS_6_MESES",
    DE_6_A_12_MESES = "DE_6_A_12_MESES",
    DE_1_A_2_ANIOS = "DE_1_A_2_ANIOS",
    DE_2_A_5_ANIOS = "DE_2_A_5_ANIOS",
    DE_5_A_10_ANIOS = "DE_5_A_10_ANIOS",
    MAS_10_ANIOS = "MAS_10_ANIOS",
}

export interface Person {
    firstName: string;
    paternalLastName: string;
    maternalLastName: string;
    phone: string;
    email: string;
    rfc?: string;
    curp?: string;
    gender?: Gender | null;
    martialStatus?: martialStatus | null;
}

export interface Applicant extends Person {
    address: string;
}

export enum HasGuarantor {
    Si = "si",
    No = "no",
}

export enum Relationship {
    Padre = "Padre",
    Madre = "Madre",
    Hermano = "Hermano",
    Familiar = "Familiar",
    Amigo = "Amigo",
    Otro = "Otro",
}

export interface Guarantor extends Person {
    hasGuarantor: HasGuarantor | null;
    relationship?: Relationship | null;
}

export interface Employment {
    company: string;
    position: string;
    monthlyIncome: number;
    supervisorName?: string;
    phoneCompany: string;
    employmentStatus: EmploymentStatus | null;
    employmentDuration: EmploymentDuration | null;
}

export interface References {
    fullName: string;
    phone: string;
    relationship: string;
}

export interface Documents {
    officialId: File | null;
    proofOfAddress: File | null;
    proofOfIncome: File | null;
    taxCertificate: File | null;
    bankStatements: File | null;
    guarantorOfficialId: File | null;
    guarantorProofOfAddress: File | null;
}

export interface RentalApplication {

    folio: string;

    propertyId: number;

    personal: Applicant;

    ocupationDate: string;

    employment: Employment

    guarantor: Guarantor;

    references: References[];

    documents: Documents;
}

export const RENTAL_STEPS = [
    {
        id: RentalStep.PERSONAL,
        label: "Datos personales",
    },
    {
        id: RentalStep.EMPLOYMENT,
        label: "Información laboral",
    },
    {
        id: RentalStep.GUARANTOR,
        label: "Información Fiador",
    },
    {
        id: RentalStep.REFERENCES,
        label: "Referencias",
    },
    {
        id: RentalStep.DOCUMENTS,
        label: "Documentos",
    },
    {
        id: RentalStep.OCUPATION,
        label: "Fecha de ocupacion",
    },
    {
        id: RentalStep.SUMMARY,
        label: "Resumen",
    },
];