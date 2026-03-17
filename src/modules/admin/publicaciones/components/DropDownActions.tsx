"use client"
import { supabase } from "@/lib/supabaseClient"
import { useState } from "react"
import { MoreHorizontalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

export default function DropdownMenuDialog({ idProperty, propertyName, idOwner }) {
    const userId = idOwner; // Usa el idOwner pasado como prop
    const [deleteProperty, setDeleteProperty] = useState(false)

    const handleDelete = async () => {
        try {
            // 1) Obtener los filenames antes de borrar nada
            const { data: imgs, error: imgErr } = await supabase
                .from("property_images")
                .select("filename")
                .eq("property_id", idProperty);

            if (imgErr) throw imgErr;

            const filePaths = imgs.map(img => `${userId}/${idProperty}/${img.filename}`);

            // 2) Borrar archivos del bucket
            const { error: bucketErr } = await supabase
                .storage
                .from("properties")
                .remove(filePaths);

            if (bucketErr) throw bucketErr;

            // 3) Borrar registros de property_images
            const { error: deleteImgsErr } = await supabase
                .from("property_images")
                .delete()
                .eq("property_id", idProperty);

            if (deleteImgsErr) throw deleteImgsErr;

            // 4) Borrar la propiedad
            const { error: deletePropErr } = await supabase
                .from("properties")
                .delete()
                .eq("id", idProperty);

            if (deletePropErr) throw deletePropErr;

            toast.success("Propiedad eliminada exitosamente");

        } catch (err) {
            console.error(err);
            toast.error("Error al eliminar la propiedad");
        }

        setDeleteProperty(false);
    };


    return (
        <>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" aria-label="Open menu" size="icon-sm">
                        <MoreHorizontalIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40" align="end">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onSelect={() => setDeleteProperty(true)}>
                            Eliminar
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={deleteProperty} onOpenChange={setDeleteProperty}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Estas por eliminar esta propiedad <br /> {propertyName}</DialogTitle>
                        <DialogDescription>
                            Esta accion es irreversible, se eliminara toda la informacion relacionada con esta propiedad. <br /> ¿Deseas continuar?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                            className="bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-2 focus:ring-red-500"
                            type="submit"
                            onClick={handleDelete}
                        >
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
