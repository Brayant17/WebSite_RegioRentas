import { create } from "zustand";
import { type RentalApplication, RentalStep } from "../types/rental";

interface RentalStore {

    currentStep: RentalStep;

    application: RentalApplication;

    nextStep: () => void;

    previousStep: () => void;

    goToStep: (step: RentalStep) => void;

    updateFolio: (
        data: RentalApplication["folio"]
    ) => void;

    updatePersonal: (
        data: RentalApplication["personal"]
    ) => void;

    updateEmployment: (
        data: RentalApplication["employment"]
    ) => void;

    updateGuarantor: (
        data: RentalApplication["guarantor"]
    ) => void;

    updateReferences: (
        data: RentalApplication["references"]
    ) => void;

    updateDocuments: (
        data: RentalApplication["documents"]
    ) => void;

    updateOcupation: (
        data: RentalApplication["ocupationDate"]
    ) => void;

    reset: (propertyId: number) => void;

}

const initialApplication = (
    propertyId: number
): RentalApplication => ({

    folio: "",

    propertyId,

    ocupationDate: "",

    // Estos son los datos que se pediran
    personal: {
        firstName: "",
        paternalLastName: "",
        maternalLastName: "",
        email: "",
        phone: "",
        address: "",
        martialStatus: null,
        gender: null
    },

    guarantor: {
        firstName: "",
        paternalLastName: "",
        maternalLastName: "",
        email: "",
        phone: "",
        relationship: "",
    },

    employment: {
        company: "",
        position: "",
        monthlyIncome: 0,
        supervisorName: "",
        phoneCompany: "",
        employmentDuration: null,
        employmentStatus: null,
    },

    references: [
        {
            fullName: "",
            phone: "",
            relationship: "",
        },
        {
            fullName: "",
            phone: "",
            relationship: "",
        },
    ],

    documents: {

        officialId: null,

        proofOfAddress: null,

        proofOfIncome: null,

        taxCertificate: null,

        bankStatements: null,

        guarantorOfficialId: null,

        guarantorProofOfAddress: null,

    }

});

export const useRentalStore = create<RentalStore>((set) => ({

    currentStep: RentalStep.WELCOME,

    application: initialApplication(0),

    nextStep: () =>
        set((state) => ({
            currentStep: state.currentStep + 1,
        })),

    previousStep: () =>
        set((state) => ({
            currentStep: Math.max(
                RentalStep.WELCOME,
                state.currentStep - 1
            ),
        })),

    goToStep: (step) =>
        set({
            currentStep: step,
        }),

    updateFolio: (data) =>
        set((state) => ({
            application: {
                ...state.application,
                folio: data,
            }
        })),

    updatePersonal: (data) =>
        set((state) => ({
            application: {
                ...state.application,
                personal: data,
            },
        })),

    updateEmployment: (data) => (
        set((state) => ({
            application: {
                ...state.application,
                employment: data,
            }
        }))
    ),

    updateGuarantor: (data) => (
        set((state) => ({
            application: {
                ...state.application,
                guarantor: data,
            }
        }))
    ),

    updateReferences: (data) => (
        set((state) => ({
            application: {
                ...state.application,
                references: data,
            }
        }))
    ),

    updateDocuments: (data) => (
        set((state) => ({
            application: {
                ...state.application,
                documents: data,
            }
        }))
    ),

    updateOcupation: (data) => (
        set((state) => ({
            application: {
                ...state.application,
                ocupationDate: data,
            }
        }))
    ),

    reset: (propertyId) =>
        set({
            currentStep: RentalStep.WELCOME,
            application: initialApplication(propertyId),
        }),

}));