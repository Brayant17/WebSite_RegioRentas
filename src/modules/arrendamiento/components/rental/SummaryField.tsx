import { cn } from "@/lib/utils";

interface SummaryFieldProps {
    label: string;
    value?: React.ReactNode;
    className?: string;
}

export default function SummaryField({
    label,
    value,
    className,
}: SummaryFieldProps) {
    return (
        <div
            className={cn(
                "grid grid-cols-1 gap-1 py-3 md:grid-cols-[220px_1fr]",
                className
            )}
        >
            <span className="text-sm font-medium text-muted-foreground">
                {label}
            </span>

            <span className="text-sm">
                {value || "-"}
            </span>
        </div>
    );
}