import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";

import { FileUp } from "lucide-react";

import { useRentalStore } from "@/modules/arrendamiento/stores/rentalStore";
import { HasGuarantor } from "@/modules/arrendamiento/types/rental";

import {
    DocumentsSchema,
    type DocumentsForm,
} from "@/modules/arrendamiento/schemas/documents.schema";

import { DocumentUploader } from "../../DocumentUploader";

import { RENTAL_DOCUMENTS } from "@/modules/arrendamiento/constants/rentalDocuments";

export default function DocumentsStep() {

    const {
        application,
        updateDocuments,
        nextStep,
        previousStep
    } = useRentalStore();

    const hasGuarantor = application.guarantor.hasGuarantor === HasGuarantor.Si;

    const visibleDocuments = RENTAL_DOCUMENTS.filter(
        (document) => !document.isGuarantorDocument || hasGuarantor
    );

    const form = useForm<DocumentsForm>({
        resolver: zodResolver(DocumentsSchema),
        defaultValues: application.documents,
    });

    const onSubmit = (values: DocumentsForm) => {

        updateDocuments(values);

        nextStep();

    };

    const handleBack = ()=>{
        previousStep();
    }

    return (

        <Card>

            <CardHeader>

                <div className="flex items-center gap-3">

                    <FileUp className="size-6 text-primary" />

                    <div>

                        <CardTitle>
                            Documentos
                        </CardTitle>

                        <CardDescription>
                            Adjunta los documentos solicitados.
                        </CardDescription>

                    </div>

                </div>

            </CardHeader>

            <CardContent>

                <Form {...form}>

                    <form
                        id="documentsStep"
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >

                        {visibleDocuments.map((document) => (

                            <DocumentUploader
                                key={document.name}
                                label={document.label}
                                description={document.description}
                                required={document.required}
                                value={form.watch(document.name)}
                                onChange={(file) => {

                                    form.setValue(
                                        document.name,
                                        file,
                                        {
                                            shouldValidate: true,
                                            shouldDirty: true,
                                        }
                                    );

                                }}
                            />

                        ))}

                    </form>

                </Form>

            </CardContent>

            <CardFooter className="justify-between">
                <Button type="button" onClick={handleBack} variant="outline" >
                    Atras
                </Button>

                <Button
                    type="submit"
                    form="documentsStep"
                >
                    Continuar
                </Button>

            </CardFooter>

        </Card>

    );

}