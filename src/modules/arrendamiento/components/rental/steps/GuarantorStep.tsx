import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox";

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
    hasGuarantorOptions,
    guarantorRelationshipOptions,
    type EnumOption,
} from "@/modules/arrendamiento/constants/personal.constants";

import {
    GuarantorSchema,
    type GuarantorFormInput,
    type GuarantorFormOutput,
} from "@/modules/arrendamiento/schemas/guarantor.schema";

import {
    HasGuarantor,
} from "@/modules/arrendamiento/types/rental";


export default function GuarantorStep() {
    const {
        application,
        updateGuarantor,
        nextStep,
    } = useRentalStore();

    const form = useForm<GuarantorFormInput, any, GuarantorFormOutput>({
        resolver: zodResolver(GuarantorSchema),
        defaultValues: application.guarantor,
    });

    const hasGuarantor = form.watch("hasGuarantor");

    const onSubmit = (values: GuarantorFormOutput) => {
        if (values.hasGuarantor === HasGuarantor.No) {
            updateGuarantor({
                firstName: "",
                paternalLastName: "",
                maternalLastName: "",
                email: "",
                phone: "",
                hasGuarantor: HasGuarantor.No,
                relationship: null,
            });
            nextStep();
            return;
        }

        updateGuarantor({
            firstName: values.firstName ?? "",
            paternalLastName: values.paternalLastName ?? "",
            maternalLastName: values.maternalLastName ?? "",
            email: values.email ?? "",
            phone: values.phone ?? "",
            hasGuarantor: values.hasGuarantor ?? HasGuarantor.Si,
            relationship: values.relationship ?? null,
        });
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
                                name="hasGuarantor"
                                render={({ field, fieldState }) => {
                                    const selected: EnumOption | null =
                                        hasGuarantorOptions.find(
                                            (option) => option.value === field.value
                                        ) ?? null;

                                    return (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>¿Cuentas con fiador?</FormLabel>
                                            <Combobox<EnumOption>
                                                items={hasGuarantorOptions}
                                                itemToStringValue={(option) => option.label}
                                                value={selected}
                                                onValueChange={(option) =>
                                                    field.onChange(option?.value ?? undefined)
                                                }
                                            >
                                                <FormControl>
                                                    <ComboboxInput
                                                        placeholder="Selecciona una opción"
                                                        onBlur={field.onBlur}
                                                        aria-invalid={!!fieldState.error}
                                                        autoComplete="off"
                                                    />
                                                </FormControl>
                                                <ComboboxContent>
                                                    <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
                                                    <ComboboxList>
                                                        {(option) => (
                                                            <ComboboxItem
                                                                key={option.value}
                                                                value={option}
                                                            >
                                                                {option.label}
                                                            </ComboboxItem>
                                                        )}
                                                    </ComboboxList>
                                                </ComboboxContent>
                                            </Combobox>
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
                            />

                            {hasGuarantor === HasGuarantor.Si ? (
                                <>
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

                                    <FormField
                                        control={form.control}
                                        name="relationship"
                                        render={({ field, fieldState }) => {
                                            const selected: EnumOption | null =
                                                guarantorRelationshipOptions.find(
                                                    (option) => option.value === field.value
                                                ) ?? null;

                                            return (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Parentesco</FormLabel>
                                                    <Combobox<EnumOption>
                                                        items={guarantorRelationshipOptions}
                                                        itemToStringValue={(option) => option.label}
                                                        value={selected}
                                                        onValueChange={(option) =>
                                                            field.onChange(option?.value ?? undefined)
                                                        }
                                                    >
                                                        <FormControl>
                                                            <ComboboxInput
                                                                placeholder="Selecciona un parentesco"
                                                                onBlur={field.onBlur}
                                                                aria-invalid={!!fieldState.error}
                                                                autoComplete="off"
                                                            />
                                                        </FormControl>
                                                        <ComboboxContent>
                                                            <ComboboxEmpty>
                                                                Sin resultados.
                                                            </ComboboxEmpty>
                                                            <ComboboxList>
                                                                {(option) => (
                                                                    <ComboboxItem
                                                                        key={option.value}
                                                                        value={option}
                                                                    >
                                                                        {option.label}
                                                                    </ComboboxItem>
                                                                )}
                                                            </ComboboxList>
                                                        </ComboboxContent>
                                                    </Combobox>
                                                    <FormMessage />
                                                </FormItem>
                                            );
                                        }}
                                    />
                                </>
                            ) : null}
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