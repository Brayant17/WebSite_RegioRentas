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

import { UserCheck } from "lucide-react";

import { useRentalStore } from "@/modules/arrendamiento/stores/rentalStore";

import {
    GuarantorSchema,
    type GuarantorForm,
} from "@/modules/arrendamiento/schemas/guarantor.schema";


export default function GuarantorStep() {
    const {
        application,
        updateGuarantor,
        nextStep,
    } = useRentalStore();

    const form = useForm<GuarantorForm>({
        resolver: zodResolver(GuarantorSchema),
        defaultValues: application.guarantor,
    });

    const onSubmit = (values: GuarantorForm) => {
        updateGuarantor(values);
        nextStep();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <UserCheck className="size-6 text-primary" />
                    <div>
                        <CardTitle>
                            Información del fiador
                        </CardTitle>
                        <CardDescription>
                            Ingresa los datos de tu fiador o aval.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <Form {...form}>
                    <form
                        id="guarantorStep"
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
                        <div className="grid gap-6 md:grid-cols-2">

                            <FormField
                                control={form.control}
                                name="firstName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre(s)</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Juan"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="paternalLastName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Apellido paterno</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Pérez"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="maternalLastName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Apellido materno</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="García"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Correo electrónico</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="correo@ejemplo.com"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Teléfono</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="8112345678"
                                                maxLength={10}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                        </div>
                    </form>
                </Form>
            </CardContent>

            <CardFooter className="justify-end">
                <Button
                    type="submit"
                    form="guarantorStep"
                >
                    Continuar
                </Button>
            </CardFooter>
        </Card>
    );
}