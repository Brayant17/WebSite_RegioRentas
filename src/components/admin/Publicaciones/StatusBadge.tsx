import { Badge } from "@/components/ui/badge";
import { IconCircleCheckFilled, IconLoader } from "@tabler/icons-react";
import { CheckCircle, Loader2, Circle, XCircle } from "lucide-react";

type Status =
    | "Disponible"

export function StatusBadge({ status }: { status: Status }) {
    switch (status) {
        case "Disponible":
            return (
                <Badge variant="outline" className="text-muted-foreground px-1.5">
                    <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
                    Disponible
                </Badge>
            );

        default:
            return (
                <Badge variant="secondary" className="gap-1">
                    <Circle className="h-3 w-3" />
                    Unknown
                </Badge>
            );
    }
}
