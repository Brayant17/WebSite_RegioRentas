import { Badge } from "@/components/ui/badge";
import { IconCircleCheckFilled, IconLoader } from "@tabler/icons-react";
import { CheckCircle, Loader2, Circle, XCircle } from "lucide-react";

type Status =
    | "approved"
    | "pending"
    | "rejected"
    | "in_process"
    | "done";

export function StatusBadge({ status }: { status: Status }) {
    switch (status) {
        case "approved":
        case "done":
            return (
                <Badge variant="outline" className="text-muted-foreground px-1.5">
                    <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
                    Done
                </Badge>
            );

        case "in_process":
        case "pending":
            return (
                <Badge variant="outline" className="text-muted-foreground px-1.5">
                    <IconLoader />
                    In Process
                </Badge>
            );

        case "rejected":
            return (
                <Badge variant="outline" className="bg-red-100 text-red-800 gap-1">
                    <XCircle className="h-3 w-3" />
                    Rejected
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
