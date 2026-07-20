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

import { BriefcaseBusiness } from "lucide-react";

import { useRentalStore } from "@/modules/arrendamiento/stores/rentalStore";

import {
    EmploymentSchema,
    type EmployForm,
} from "@/modules/arrendamiento/schemas/employment.schema";

export default function EmploymentStep() {
    const {
        application,
        updateEmployment,
        nextStep,
    } = useRentalStore();

    const form = useForm<EmployForm>({
        resolver: zodResolver(EmploymentSchema),
        defaultValues: application.employment,
    });

    const onSubmit = (values: EmployForm) => {
        updateEmployment(values);
        nextStep();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <BriefcaseBusiness className="size-6 text-primary" />
                    <div>
                        <CardTitle>Información laboral</CardTitle>
                        <CardDescription>
                            Ingresa la información de tu empleo actual.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <Form {...form}>
                    <form
                        id="employmentStep"
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
                        <div className="grid gap-6 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="company"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Empresa</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Empresa S.A. de C.V."
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="position"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Puesto</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Desarrollador de Software"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="monthlyIncome"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ingreso mensual</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                placeholder="25000"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="phoneCompany"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Teléfono de la empresa</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                placeholder="8112345678"
                                                maxLength={10}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="supervisorName"
                                render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Nombre del jefe inmediato</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Juan Pérez"
                                                {...field}
                                                value={field.value ?? ""}
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
                <Button type="submit" form="employmentStep">
                    Continuar
                </Button>
            </CardFooter>
        </Card>
    );
}