// Orquestador de flujos, su reponsabilidad es decidir que pantalla debe verse, Welcome o Stepper
import { useEffect } from "react";
import { RentalStep } from "../../types/rental";
import { useRentalStore } from "../../stores/rentalStore";

import Welcome from "./Welcome";
import RentalStepper from "./RentalStepper";

interface Props {
    unit: any;
}

export default function RentalFlow({ unit }: Props) {

    const {

        currentStep,

        goToStep,

        reset,

    } = useRentalStore();

    useEffect(() => {
        // Cada vez que la unidad cambia limpia el store, y vuelve al estado inical, guarda el nuevo unit.id

        reset(unit.id);
    }, [unit.id, reset]);

    return currentStep === RentalStep.WELCOME ? (
        <div className="w-full px-3">
            <Welcome
                unit={unit}
                onStart={() => goToStep(RentalStep.PERSONAL)}
            />
        </div>
    ) : (
        <div className="w-full px-3">
            <RentalStepper />
        </div>
    );
}