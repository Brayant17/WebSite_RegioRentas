// Aqui empieza el Stepper
import { useRentalStore } from "../../stores/rentalStore";
import { RENTAL_STEPS } from "../../types/rental";

import Stepper from "./Stepper";

import PersonalStep from "./steps/PersonalStep";
import EmploymentStep from "./steps/EmploymentStep";
import ReferencesStep from "./steps/ReferencesStep";
import DocumentsStep from "./steps/DocumentsStep";
import SummaryStep from "./steps/SummaryStep";
import GuarantorStep from "./steps/GuarantorStep";
import OcupationStep from "./steps/OcupationStep";
import Success from "./Succes";

export default function RentalStepper() {
    const { currentStep } = useRentalStore();


    const stepComponents = {
        [RENTAL_STEPS[0].id]: <PersonalStep />,
        [RENTAL_STEPS[1].id]: <EmploymentStep />,
        [RENTAL_STEPS[2].id]: <GuarantorStep />,
        [RENTAL_STEPS[3].id]: <ReferencesStep />,
        [RENTAL_STEPS[4].id]: <DocumentsStep />,
        [RENTAL_STEPS[5].id]: <OcupationStep />,
        [RENTAL_STEPS[6].id]: <SummaryStep />,
    };

    return (
        <section className="mx-auto max-w-5xl space-y-8 py-10">
            {/* Vista de los circulitos que marcan el stepper <Stepper /.>*/}
            <Stepper />
            {stepComponents[currentStep]}
        </section>
    );
}