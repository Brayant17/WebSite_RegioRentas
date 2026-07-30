import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import {
    Form
} from "@/components/ui/form";

import {
    edificioSchema,
    type EdificioForm,
} from "@/modules/admin/arrendamiento/propiedades/schemas/edificio.schema";
import { FormInput } from "./forms/FormInput";
import { FormSelect } from "./forms/FormSelect";
import type { Edificio } from "../../types/edificios.type";
import { editEdificio, saveEdificio } from "../services/propiedades.service";
import { toast } from "sonner";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: "create" | "edit";
    edificio?: Edificio | null;
    onSuccess?: (edificio: Edificio) => void;
};

const typeEdificios = [
    {
        label: "Departamento",
        value: "Departamento",
    },
    {
        label: "Casa",
        value: "Casa",
    },
];

const statusOptions = [
    {
        label: "Activo",
        value: "activo",
    },
    {
        label: "Inactivo",
        value: "inactivo",
    },
];

const DEFAULT_VALUES: EdificioForm = {
    tipo: "",
    nombre: "",
    direccion: "",
    ciudad: "",
    estado: "",
    codigo_postal: "",
    estatus: "activo",
};

export function EdificioDialog({
    open,
    onOpenChange,
    mode,
    edificio,
    onSuccess
}: Props) {
    const form = useForm<EdificioForm>({
        resolver: zodResolver(edificioSchema),
        defaultValues: DEFAULT_VALUES,
    });

    useEffect(() => {
        if (mode === "edit" && edificio) {
            form.reset({
                tipo: edificio.type,
                nombre: edificio.nombre,
                direccion: edificio.direccion,
                ciudad: edificio.ciudad,
                estado: edificio.estado,
                codigo_postal: edificio.codigo_postal,
                estatus: edificio.estatus,
            });
        } else {
            form.reset(DEFAULT_VALUES);
        }
    }, [mode, edificio, form]);

    const onSubmit = async (values: EdificioForm) => {
        try {
            let edificioGuardado: Edificio;

            if (mode === "create") {
                edificioGuardado = await saveEdificio(values);
            } else {
                edificioGuardado = await editEdificio(edificio!.id, values);
            }

            form.reset(DEFAULT_VALUES);

            onSuccess?.(edificioGuardado);

            onOpenChange(false);

            toast.success(
                "El edificio guardo correctamente.",
                { position: "top-center" }
            );

        } catch (error) {
            console.error(error); // Para ti como desarrollador

            toast.error(
                "No fue posible crear el edificio. Inténtalo nuevamente.",
                { position: "top-center" }
            );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "create" ? "Crear" : "Editar"} Edificio
                    </DialogTitle>

                    <DialogDescription>
                        {mode === "create"
                            ? "Completa la información para crear un nuevo edificio."
                            : "Modifica la información del edificio y guarda los cambios."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
                        <div className="grid grid-cols-2 gap-4">

                            <FormSelect
                                control={form.control}
                                name="tipo"
                                label="Tipo de edificio"
                                items={typeEdificios}
                                placeholder="Selecciona un tipo"
                            />

                            <FormSelect
                                control={form.control}
                                name="estatus"
                                label="Estatus"
                                items={statusOptions}
                                placeholder="Selecciona un estatus"
                            />

                            <FormInput
                                control={form.control}
                                name="nombre"
                                label="Nombre del edificio"
                                placeholder="Torre Palma"
                                className="col-span-2"
                            />

                            <FormInput
                                control={form.control}
                                name="direccion"
                                label="Dirección"
                                placeholder="San Bartolomé 231"
                                className="col-span-2"
                            />

                            <FormInput
                                control={form.control}
                                name="ciudad"
                                label="Ciudad"
                                placeholder="Monterrey"
                            />

                            <FormInput
                                control={form.control}
                                name="estado"
                                label="Estado"
                                placeholder="Nuevo León"
                            />

                            <FormInput
                                control={form.control}
                                name="codigo_postal"
                                label="Código Postal"
                                placeholder="64000"
                                className="col-span-2"
                            />

                        </div>

                        <DialogFooter className="border-t pt-4">
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                >
                                    Cancelar
                                </Button>
                            </DialogClose>

                            <Button type="submit">
                                {mode === "create"
                                    ? "Crear edificio"
                                    : "Guardar cambios"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}