import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RequestDetailsModal({ open, request, onClose }: { open: boolean, request: any, onClose: () => void }) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <form>
                <DialogContent >
                    <DialogHeader>
                        <DialogTitle>Detalles de la solicitud</DialogTitle>
                        <DialogDescription>
                            Aquí puedes ver los detalles de la solicitud de actualización a premium del usuario.
                                Revisa la información cuidadosamente antes de aprobar o rechazar la solicitud.
                            done.
                        </DialogDescription>
                    </DialogHeader>
                    <FieldGroup>
                        <Field>
                            <Label htmlFor="name-1">Name</Label>
                            <Input id="name-1" name="name" defaultValue="Pedro Duarte" />
                        </Field>
                        <Field>
                            <Label htmlFor="username-1">Username</Label>
                            <Input id="username-1" name="username" defaultValue="@peduarte" />
                        </Field>
                    </FieldGroup>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit">Save changes</Button>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    );
}