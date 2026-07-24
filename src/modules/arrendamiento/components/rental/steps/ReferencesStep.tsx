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

import { Users } from "lucide-react";

import { useRentalStore } from "@/modules/arrendamiento/stores/rentalStore";

import {
    ReferencesSchema,
    type ReferencesFormInput,
    type ReferencesFormOutput,
} from "@/modules/arrendamiento/schemas/references.schema";
import {
    guarantorRelationshipOptions,
    type EnumOption,
} from "@/modules/arrendamiento/constants/personal.constants";

export default function ReferencesStep() {
    const {
        application,
        updateReferences,
        nextStep,
    } = useRentalStore();

    const form = useForm<ReferencesFormInput, any, ReferencesFormOutput>({
        resolver: zodResolver(ReferencesSchema),
        defaultValues: {
            references: application.references,
        },
    });

    const onSubmit = (values: ReferencesFormOutput) => {
        updateReferences(values.references);
        nextStep();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Users className="size-6 text-primary" />
                    <div>
                        <CardTitle>
                            Referencias personales
                        </CardTitle>
                        <CardDescription>
                            Ingresa dos referencias personales.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <Form {...form}>
                    <form
                        id="referencesStep"
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-8"
                    >
                        {form.watch("references").map((_, index) => (
                            <Card key={index}>
                                <CardHeader>
                                    <CardTitle className="text-lg">
                                        Referencia {index + 1}
                                    </CardTitle>
                                </CardHeader>

                                <CardContent>
                                    <div className="grid gap-6 md:grid-cols-2">

                                        <FormField
                                            control={form.control}
                                            name={`references.${index}.fullName`}
                                            render={({ field }) => (
                                                <FormItem className="md:col-span-2">
                                                    <FormLabel>
                                                        Nombre completo
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Juan Pérez García"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name={`references.${index}.phone`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        Teléfono
                                                    </FormLabel>
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
                                            name={`references.${index}.relationship`}
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

                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </form>
                </Form>
            </CardContent>

            <CardFooter className="justify-end">
                <Button
                    type="submit"
                    form="referencesStep"
                >
                    Continuar
                </Button>
            </CardFooter>
        </Card>
    );
}