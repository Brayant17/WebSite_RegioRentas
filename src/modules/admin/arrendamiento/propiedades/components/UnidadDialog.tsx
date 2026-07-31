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

import { Form } from "@/components/ui/form";

import {
    unidadSchema,
    type UnidadForm,
} from "@/modules/admin/arrendamiento/propiedades/schemas/unidad.schema";

import { FormInput } from "./forms/FormInput";
import { FormSelect } from "./forms/FormSelect";

import type { Unit } from "@/modules/admin/arrendamiento/types/Unit";

import { saveUnidad, editUnidad } from "../services/propiedades.service";

import { toast } from "sonner";


type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: "create" | "edit";
    unidad?: Unit | null;
    edificioId: string;
    onSuccess?: (unidad: Unit) => void;
};


const tipoUnidadOptions = [
    {
        label: "Departamento",
        value: "Departamento",
    },
    {
        label: "Loft",
        value: "Loft",
    },
    {
        label: "Penthouse",
        value: "Penthouse",
    },
    {
        label: "Estudio",
        value: "Estudio",
    },
];


const ubicacionOptions = [
    {
        label: "Vista Calle",
        value: "Vista Calle",
    },
    {
        label: "Interior",
        value: "Interior",
    },
    {
        label: "Esquina",
        value: "Esquina",
    },
];


const DEFAULT_VALUES: UnidadForm = {
    nombre: "",
    numero: "",
    piso: 0,
    tipo: "Departamento",
    recamaras: 0,
    area: 0,
    ubicacion: "",
    precio_renta: 0,
};


export function UnidadDialog({
    open,
    onOpenChange,
    mode,
    unidad,
    edificioId,
    onSuccess,
}: Props) {

    const form = useForm<UnidadForm>({
        resolver: zodResolver(unidadSchema),
        defaultValues: DEFAULT_VALUES,
    });


    useEffect(() => {

        if (mode === "edit" && unidad) {
            form.reset({
                nombre: unidad.nombre,
                numero: unidad.numero,
                piso: Number(unidad.piso),
                tipo: unidad.tipo,
                recamaras: Number(unidad.recamaras),
                area: Number(unidad.area),
                ubicacion: unidad.ubicacion,
                precio_renta: Number(unidad.precio_renta),
            });

        } else {
            form.reset(DEFAULT_VALUES);
        }

    }, [mode, unidad, form]);



    const onSubmit = async (values: UnidadForm) => {

        try {

            let unidadGuardada: Unit;

            if (mode === "create") {
                unidadGuardada = await saveUnidad(values, edificioId);
            } else {
                if(!unidad){
                    throw new Error("No se seleciono nignuna unidad")
                }
                unidadGuardada = await editUnidad(values, edificioId, Number(unidad.id));
            }


            onSuccess?.(unidadGuardada);

            onOpenChange(false);

            form.reset(DEFAULT_VALUES);


            toast.success(
                "La unidad se guardó correctamente.",
                {
                    position: "top-center",
                }
            );


        } catch (error) {

            console.error(error);

            toast.error(
                "No fue posible guardar la unidad. Inténtalo nuevamente.",
                {
                    position: "top-center",
                }
            );

        }
    };


    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="sm:max-w-2xl">

                <DialogHeader>
                    <DialogTitle>
                        {mode === "create"
                            ? "Crear unidad"
                            : "Editar unidad"}
                    </DialogTitle>

                    <DialogDescription>
                        {mode === "create"
                            ? "Completa la información para crear una nueva unidad."
                            : "Modifica la información de la unidad y guarda los cambios."}
                    </DialogDescription>
                </DialogHeader>


                <Form {...form}>

                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >

                        <div className="grid grid-cols-2 gap-4">


                            <FormInput
                                control={form.control}
                                name="numero"
                                label="Número de unidad"
                                placeholder="1A"
                            />


                            <FormInput
                                control={form.control}
                                name="nombre"
                                label="Nombre"
                                placeholder="Unidad 1-A"
                            />


                            <FormSelect
                                control={form.control}
                                name="tipo"
                                label="Tipo de unidad"
                                items={tipoUnidadOptions}
                                placeholder="Selecciona un tipo"
                            />


                            <FormInput
                                control={form.control}
                                name="piso"
                                label="Piso"
                                placeholder="1"
                            />


                            <FormInput
                                control={form.control}
                                name="recamaras"
                                label="Recámaras"
                                placeholder="2"
                            />


                            <FormInput
                                control={form.control}
                                name="area"
                                label="Área (m²)"
                                placeholder="85"
                            />


                            <FormSelect
                                control={form.control}
                                name="ubicacion"
                                label="Ubicación"
                                items={ubicacionOptions}
                                placeholder="Selecciona ubicación"
                            />


                            <FormInput
                                control={form.control}
                                name="precio_renta"
                                label="Precio renta"
                                placeholder="1200"
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
                                    ? "Crear unidad"
                                    : "Guardar cambios"}

                            </Button>

                        </DialogFooter>

                    </form>

                </Form>

            </DialogContent>

        </Dialog>
    );
}
