import { create } from "zustand";
import { type RentalApplication, RentalStep } from "../types/rental";

interface RentalStore {

    currentStep: RentalStep;

    application: RentalApplication;

    nextStep: () => void;

    previousStep: () => void;

    goToStep: (step: RentalStep) => void;

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

    reset: (propertyId: number) => void;

}

const initialApplication = (
    propertyId: number
): RentalApplication => ({

    propertyId,

    // Estos son los datos que se pediran
    personal: {
        firstName: "",
        paternalLastName: "",
        maternalLastName: "",
        email: "",
        phone: "",
        address: "",
    },

    guarantor: {
        firstName: "",
        paternalLastName: "",
        maternalLastName: "",
        email: "",
        phone: ""
    },

    employment: {
        company: "",
        position: "",
        monthlyIncome: 0,
        supervisorName: "",
        phoneCompany: "",
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

    reset: (propertyId) =>
        set({
            currentStep: RentalStep.WELCOME,
            application: initialApplication(propertyId),
        }),

}));