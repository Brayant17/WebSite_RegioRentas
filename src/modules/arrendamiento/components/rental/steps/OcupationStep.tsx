import { FileUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { useRentalStore } from "@/modules/arrendamiento/stores/rentalStore";

import {
    OcupationSchema,
    type OcupationForm,
} from "@/modules/arrendamiento/schemas/ocupation.schema";
import DatePicker from "../../DatePicker";

export default function OcupationStep() {

    const {
        application,
        updateOcupation,
        nextStep,
        previousStep
    } = useRentalStore();

    const form = useForm<OcupationForm>({
        resolver: zodResolver(OcupationSchema),
        defaultValues: {
            ocupationDate: application.ocupationDate
        },
    });

    const onSubmit = (data: OcupationForm) => {
        updateOcupation(data.ocupationDate);
        nextStep();
    };

    const handleBack = () => {
        previousStep();
    }

    return (
        <Card>

            <CardHeader>

                <div className="flex items-center gap-3">

                    <FileUp className="size-6 text-primary" />

                    <div>

                        <CardTitle>
                            Datos de la unidad
                        </CardTitle>

                        <CardDescription>
                            Llena los campos solicitados
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
                        <FormField
                            control={form.control}
                            name="ocupationDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Fecha de ocupación</FormLabel>
                                    <FormControl>
                                        <DatePicker
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
    )
}