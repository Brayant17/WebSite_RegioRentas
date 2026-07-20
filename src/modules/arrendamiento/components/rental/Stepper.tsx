import { RENTAL_STEPS } from "../../types/rental";
import { useRentalStore } from "../../stores/rentalStore";

export default function Stepper() {
    const { currentStep } = useRentalStore();

    return (
        <div className="mb-10">
            <div className="flex justify-between">
                {RENTAL_STEPS.map((step) => {
                    const active = currentStep === step.id;
                    const completed = currentStep > step.id;

                    return (
                        <div
                            key={step.id}
                            className="flex min-w-0 flex-1 flex-col items-center"
                        >
                            <div
                                className={[
                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition sm:h-10 sm:w-10 sm:text-sm",
                                    completed && "border-primary bg-primary text-white",
                                    active && "border-primary bg-primary text-white",
                                    !active && !completed && "border-gray-300 text-gray-400",
                                ].join(" ")}
                            >
                                {completed ? "✓" : step.id}
                            </div>

                            <span
                                className={[
                                    "mt-2 line-clamp-2 w-full px-1 text-center text-[10px] leading-tight break-words sm:mt-3 sm:text-sm sm:leading-normal",
                                    active ? "font-semibold" : "text-muted-foreground",
                                ].join(" ")}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}