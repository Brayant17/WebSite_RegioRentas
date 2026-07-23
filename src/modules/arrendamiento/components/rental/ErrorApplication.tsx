import { XCircle } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ErrorStepProps {
    onRetry?: () => void
}

export default function ErrorApplication({ onRetry }: ErrorStepProps) {
    return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader className="flex flex-col items-center gap-4 pb-2">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                        <XCircle className="h-9 w-9 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Algo salió mal
                    </h1>
                </CardHeader>

                <CardContent className="flex flex-col items-center gap-4 pt-2">
                    <p className="text-muted-foreground">
                        No pudimos procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.
                    </p>

                    {onRetry && (
                        <Button onClick={onRetry} className="mt-2">
                            Intentar de nuevo
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}