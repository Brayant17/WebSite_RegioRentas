import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useRentalStore } from "@/modules/arrendamiento/stores/rentalStore";
import SummarySection from "../SummarySection";
import SummaryField from "../SummaryField";
import { Button } from "@/components/ui/button";
import { RENTAL_DOCUMENTS } from "@/modules/arrendamiento/constants/rentalDocuments"

export default function SummaryStep() {

    const { application, previousStep } = useRentalStore();

    const { personal } = application;

    const handleSubmit = () => {

    }

    return (
        <>
            <SummarySection title="Datos personales">

                <SummaryField
                    label="Nombre"
                    value={`${personal.firstName} ${personal.paternalLastName} ${personal.maternalLastName}`}
                />

                <SummaryField
                    label="Correo"
                    value={personal.email}
                />

                <SummaryField
                    label="Teléfono"
                    value={personal.phone}
                />

                <SummaryField
                    label="Dirección"
                    value={personal.address}
                />

            </SummarySection>

            <SummarySection title="Información laboral">
                <SummaryField
                    label="Empresa"
                    value={application.employment.company}
                />

                <SummaryField
                    label="Puesto"
                    value={application.employment.position}
                />

                <SummaryField
                    label="Ingreso mensual"
                    value={new Intl.NumberFormat("es-MX", {
                        style: "currency",
                        currency: "MXN",
                    }).format(application.employment.monthlyIncome)}
                />

                <SummaryField
                    label="Supervisor"
                    value={application.employment.supervisorName}
                />

                <SummaryField
                    label="Teléfono de la empresa"
                    value={application.employment.phoneCompany}
                />
            </SummarySection>

            <SummarySection title="Información del fiador">
                <SummaryField
                    label="Nombre"
                    value={`${application.guarantor.firstName} ${application.guarantor.paternalLastName} ${application.guarantor.maternalLastName}`}
                />

                <SummaryField
                    label="Correo"
                    value={application.guarantor.email}
                />

                <SummaryField
                    label="Teléfono"
                    value={application.guarantor.phone}
                />
            </SummarySection>

            <SummarySection title="Referencias personales">
                {application.references.map((reference, index) => (
                    <div
                        key={index}
                        className="rounded-lg border p-4 space-y-3"
                    >
                        <h4 className="font-medium">
                            Referencia {index + 1}
                        </h4>

                        <SummaryField
                            label="Nombre"
                            value={reference.fullName}
                        />

                        <SummaryField
                            label="Teléfono"
                            value={reference.phone}
                        />

                        <SummaryField
                            label="Parentesco"
                            value={reference.relationship}
                        />
                    </div>
                ))}
            </SummarySection>

            <SummarySection title="Documentos">
                {RENTAL_DOCUMENTS.map((document) => (
                    <SummaryField
                        key={document.name}
                        label={document.label}
                        value={
                            application.documents[document.name]?.name ?? "No cargado"
                        }
                    />
                ))}
            </SummarySection>

            <CardFooter className="justify-between">
                <Button
                    variant="outline"
                    onClick={previousStep}
                >
                    Anterior
                </Button>

                <Button
                    onClick={handleSubmit}
                >
                    Enviar solicitud
                </Button>
            </CardFooter>
        </>
    );
}