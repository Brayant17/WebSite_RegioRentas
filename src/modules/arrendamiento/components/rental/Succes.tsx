import { CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useRentalStore } from "@/modules/arrendamiento/stores/rentalStore"

export default function Success() {

    const { application } = useRentalStore();

    const { folio } = application

    return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader className="flex flex-col items-center gap-4 pb-2">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle2 className="h-9 w-9 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        ¡Gracias por tu solicitud!
                    </h1>
                </CardHeader>

                <CardContent className="flex flex-col items-center gap-4 pt-2">
                    <p className="text-muted-foreground">
                        Tu solicitud fue recibida correctamente y se encuentra{" "}
                        <span className="font-medium text-foreground">en espera de revisión</span>.
                    </p>

                    <div className="flex w-full flex-col items-center gap-1 rounded-lg border bg-muted/40 p-4">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            Folio de tu solicitud
                        </span>
                        <Badge variant="secondary" className="px-3 py-1 text-base font-mono">
                            {folio}
                        </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                        Guarda este folio, lo necesitarás para dar seguimiento a tu solicitud.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}