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
    genderOptions,
    martialStatusOptions,
    type EnumOption,
} from "@/modules/arrendamiento/constants/personal.constants";

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

import { User } from "lucide-react";

import { useRentalStore } from "@/modules/arrendamiento/stores/rentalStore";

import {
    PersonalSchema,
    type PersonalFormInput,
    type PersonalFormOutput,
    type PersonalForm,
} from "@/modules/arrendamiento/schemas/personal.schema";


export default function PersonalStep() {
    const {
        application,
        updatePersonal,
        nextStep,
    } = useRentalStore();

    const form = useForm<PersonalFormInput, any, PersonalFormOutput>({
        resolver: zodResolver(PersonalSchema),
        defaultValues: application.personal,
    });

    const onSubmit = (values: PersonalFormOutput) => {
        updatePersonal(values);
        nextStep();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <User className="size-6 text-primary" />
                    <div>
                        <CardTitle>
                            Datos personales
                        </CardTitle>
                        <CardDescription>
                            Ingresa la información del solicitante.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                        id="peronsalStep"
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
                        {/* Campos */}
                        <div className="grid gap-6 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="firstName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre</FormLabel>
                                        <FormControl> 
                                            <Input placeholder="Juan Antonio" {...field} />
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
                                            <Input placeholder="Rosales" {...field} />
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
                                            <Input placeholder="Hernandez" {...field} />
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
                                        <FormLabel>Correo</FormLabel>
                                        <FormControl>
                                            <Input placeholder="example@example.com" {...field} />
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
                                        <FormLabel>Telefono</FormLabel>
                                        <FormControl>
                                            <Input placeholder="8123456789" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Domicilio de origen</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Col Paraje Calle siempre viva 2349 " {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="gender"
                                render={({ field, fieldState }) => {
                                    const selected: EnumOption | null =
                                        genderOptions.find((option) => option.value === field.value) ?? null;

                                    return (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Género</FormLabel>
                                            <Combobox<EnumOption>
                                                items={genderOptions}
                                                itemToStringValue={(option) => option.label}
                                                value={selected}
                                                onValueChange={(option) => field.onChange(option?.value ?? undefined)}
                                            >
                                                <FormControl>
                                                    <ComboboxInput
                                                        placeholder="Selecciona un género"
                                                        onBlur={field.onBlur}
                                                        aria-invalid={!!fieldState.error}
                                                    />
                                                </FormControl>
                                                <ComboboxContent>
                                                    <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
                                                    <ComboboxList>
                                                        {(option) => (
                                                            <ComboboxItem key={option.value} value={option}>
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
                                name="martialStatus"
                                render={({ field, fieldState }) => {
                                    const selected: EnumOption | null =
                                        martialStatusOptions.find((option) => option.value === field.value) ?? null;

                                    return (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Tipo de relación civil</FormLabel>
                                            <Combobox<EnumOption>
                                                items={martialStatusOptions}
                                                itemToStringValue={(option) => option.label}
                                                value={selected}
                                                onValueChange={(option) => field.onChange(option?.value ?? undefined)}
                                            >
                                                <FormControl>
                                                    <ComboboxInput
                                                        placeholder="Selecciona un estado civil"
                                                        onBlur={field.onBlur}
                                                        aria-invalid={!!fieldState.error}
                                                        autoComplete="off"
                                                    />
                                                </FormControl>
                                                <ComboboxContent>
                                                    <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
                                                    <ComboboxList>
                                                        {(option) => (
                                                            <ComboboxItem key={option.value} value={option}>
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
                                name="rfc"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>RFC</FormLabel>
                                        <FormControl>
                                            <Input placeholder="ABCD010203XYZ" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="curp"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>CURP</FormLabel>
                                        <FormControl>
                                            <Input placeholder="ABCD010203HDFRNS09" {...field} />
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
                <Button type="submit" form="peronsalStep">
                    Continuar
                </Button>
            </CardFooter>
        </Card>
    )
}