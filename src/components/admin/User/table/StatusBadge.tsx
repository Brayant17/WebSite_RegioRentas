import { Badge } from "@/components/ui/badge";
import { IconCircleCheckFilled, IconLoader } from "@tabler/icons-react";
import { CheckCircle, Loader2, Circle, XCircle } from "lucide-react";

type Status =
    | "basic"
    | "premium";

export function StatusBadge({ status }: { status: Status }) {
    switch (status) {
        case "basic":
            return (
                <Badge variant="outline" className="text-muted-foreground px-1.5">
                    <Circle className="h-3 w-3" />
                    Basic
                </Badge>
            );
        case "premium":
            return (
                <Badge variant="outline" className="text-muted-foreground px-1.5">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Premium
                </Badge>
            );
        default:
            return (
                <Badge variant="outline" className="text-muted-foreground px-1.5">
                    <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
                    Unknown
                </Badge>
            );
    }
}
