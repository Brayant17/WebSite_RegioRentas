export function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Icon className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{text}</p>
        </div>
    );
}