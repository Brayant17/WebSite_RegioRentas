export interface FileUploaderProps {
    label: string;
    description?: string;

    file: File | null;
    onFileChange: (file: File | null) => void;

    capture?: "user" | "environment";

    accept?: string[];

    maxSizeMB?: number;

    required?: boolean;

    disabled?: boolean;

    className?: string;
}