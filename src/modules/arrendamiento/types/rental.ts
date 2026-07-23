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

export interface Person {
    firstName: string;
    paternalLastName: string;
    maternalLastName: string;
    phone: string;
    email: string;
}

export interface Applicant extends Person {
    address: string;
}

export interface RentalApplication {

    folio: string; 

    propertyId: number;

    personal: Applicant;

    ocupationDate: string;

    employment: {
        company: string;
        position: string;
        monthlyIncome: number;
        supervisorName?: string;
        phoneCompany: string;
    };

    guarantor: Person;

    references: Array<{
        fullName: string;
        phone: string;
        relationship: string;
    }>;

    documents: {
        officialId: File | null;

        proofOfAddress: File | null;

        proofOfIncome: File | null;

        taxCertificate: File | null;

        bankStatements: File | null;

        guarantorOfficialId: File | null;

        guarantorProofOfAddress: File | null;
    }
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