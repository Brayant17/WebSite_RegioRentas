import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummarySectionProps {
    title: string;
    children: React.ReactNode;
}

export default function SummarySection({
    title,
    children,
}: SummarySectionProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">
                    {title}
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-2">
                {children}
            </CardContent>
        </Card>
    );
}