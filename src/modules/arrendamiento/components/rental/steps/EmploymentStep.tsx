import { useForm } from "react-hook-form";
import { useEffect } from "react";
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

import { BriefcaseBusiness } from "lucide-react";

import { useRentalStore } from "@/modules/arrendamiento/stores/rentalStore";

import {
    employmentDurationOptions,
    employmentStatusOptions,
    type EnumOption,
} from "@/modules/arrendamiento/constants/personal.constants";
import { EmploymentStatus } from "@/modules/arrendamiento/types/rental";
import type { Employment } from "@/modules/arrendamiento/types/rental";

import {
    EmploymentSchema,
    type EmployFormInput,
    type EmployFormOutput,
} from "@/modules/arrendamiento/schemas/employment.schema";

export default function EmploymentStep() {
    const {
        application,
        updateEmployment,
        nextStep,
        previousStep
    } = useRentalStore();

    const form = useForm<EmployFormInput, any, EmployFormOutput>({
        resolver: zodResolver(EmploymentSchema),
        defaultValues: application.employment,
    });

    const status = form.watch("employmentStatus");

    useEffect(() => {
        if (!status) {
            return;
        }

        console.log("Se supone que el preRellenado es aqui ", application.employment)

        form.reset(
            {
                employmentStatus: status,
                company: undefined,
                position: undefined,
                monthlyIncome: undefined,
                phoneCompany: undefined,
                employmentDuration: null,
                supervisorName: undefined,
            },
            {
                keepErrors: false,
                keepDirty: false,
                keepTouched: false,
                keepIsSubmitted: false,
            }
        );
    }, [status, form]);

    const onSubmit = (values: EmployFormOutput) => {
        // normalize values to match Employment type in the store
        const cleaned: Employment = {
            company: values.company ?? "",
            position: values.position ?? "",
            monthlyIncome: values.monthlyIncome ?? 0,
            supervisorName: values.supervisorName ?? "",
            phoneCompany: values.phoneCompany ?? "",
            employmentDuration: (values.employmentDuration ?? null) as any,
            employmentStatus: values.employmentStatus as any,
        };

        updateEmployment(cleaned);
        nextStep();
    };

    const handleBack = ()=>{
        previousStep();
    }

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
                            {/* Situación laboral al inicio */}
                            <FormField
                                control={form.control}
                                name="employmentStatus"
                                render={({ field, fieldState }) => {
                                    const selected: EnumOption | null =
                                        employmentStatusOptions.find(
                                            (option) => option.value === field.value
                                        ) ?? null;

                                    return (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Situación laboral</FormLabel>
                                            <Combobox<EnumOption>
                                                items={employmentStatusOptions}
                                                itemToStringValue={(option) => option.label}
                                                value={selected}
                                                onValueChange={(option) =>
                                                    field.onChange(option?.value ?? undefined)
                                                }
                                            >
                                                <FormControl>
                                                    <ComboboxInput
                                                        placeholder="Selecciona una situación laboral"
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

                            {/* Campos condicionales según situación */}
                            {status === EmploymentStatus.Empleado && (
                                <>
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
                                                        placeholder="Gerente de Ventas"
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
                                        name="employmentDuration"
                                        render={({ field, fieldState }) => {
                                            const selected: EnumOption | null =
                                                employmentDurationOptions.find(
                                                    (option) => option.value === field.value
                                                ) ?? null;

                                            return (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Antigüedad laboral</FormLabel>
                                                    <Combobox<EnumOption>
                                                        items={employmentDurationOptions}
                                                        itemToStringValue={(option) => option.label}
                                                        value={selected}
                                                        onValueChange={(option) =>
                                                            field.onChange(option?.value ?? undefined)
                                                        }
                                                    >
                                                        <FormControl>
                                                            <ComboboxInput
                                                                placeholder="Selecciona tu antigüedad"
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
                                </>
                            )}

                            {status === EmploymentStatus.Independiente && (
                                <>
                                    <FormField
                                        control={form.control}
                                        name="position"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Actividad o profesión</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Desarrollador independiente"
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
                                        name="employmentDuration"
                                        render={({ field, fieldState }) => {
                                            const selected: EnumOption | null =
                                                employmentDurationOptions.find(
                                                    (option) => option.value === field.value
                                                ) ?? null;

                                            return (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Antigüedad laboral</FormLabel>
                                                    <Combobox<EnumOption>
                                                        items={employmentDurationOptions}
                                                        itemToStringValue={(option) => option.label}
                                                        value={selected}
                                                        onValueChange={(option) =>
                                                            field.onChange(option?.value ?? undefined)
                                                        }
                                                    >
                                                        <FormControl>
                                                            <ComboboxInput
                                                                placeholder="Selecciona tu antigüedad"
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
                                </>
                            )}

                            {status === EmploymentStatus.Empresario && (
                                <>
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
                                                <FormLabel>Cargo</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Propietario / Director"
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
                                        name="employmentDuration"
                                        render={({ field, fieldState }) => {
                                            const selected: EnumOption | null =
                                                employmentDurationOptions.find(
                                                    (option) => option.value === field.value
                                                ) ?? null;

                                            return (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Antigüedad laboral</FormLabel>
                                                    <Combobox<EnumOption>
                                                        items={employmentDurationOptions}
                                                        itemToStringValue={(option) => option.label}
                                                        value={selected}
                                                        onValueChange={(option) =>
                                                            field.onChange(option?.value ?? undefined)
                                                        }
                                                    >
                                                        <FormControl>
                                                            <ComboboxInput
                                                                placeholder="Selecciona tu antigüedad"
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
                                </>
                            )}

                            {status === EmploymentStatus.Pensionado && (
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
                            )}

                            {status === EmploymentStatus.Otro && (
                                <FormField
                                    control={form.control}
                                    name="monthlyIncome"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Ingreso mensual (opcional)</FormLabel>
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
                            )}

                            {/* Estudiante: no mostrar campos adicionales */}
                        </div>
                    </form>
                </Form>
            </CardContent>

            <CardFooter className="flex justify-between">
                <Button type="button" onClick={handleBack} variant="outline" >
                    Atras
                </Button>
                <Button type="submit" form="employmentStep">
                    Continuar
                </Button>
            </CardFooter>
        </Card>
    );
}