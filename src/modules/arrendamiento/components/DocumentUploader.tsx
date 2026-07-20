import { useMemo } from "react";
import { useDropzone } from "react-dropzone";

import {
    CheckCircle,
    FileText,
    Image,
    Upload,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface DocumentUploaderProps {
    value: File | null;
    onChange: (file: File | null) => void;

    label: string;
    description?: string;
    required?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
];

export function DocumentUploader({
    value,
    onChange,
    label,
    description,
    required = false,
}: DocumentUploaderProps) {

    const previewUrl = useMemo(() => {

        if (!value) return null;

        if (!value.type.startsWith("image/")) {
            return null;
        }

        return URL.createObjectURL(value);

    }, [value]);

    const handleFile = (file: File) => {

        if (!ALLOWED_TYPES.includes(file.type)) {
            alert("Solo se permiten archivos PDF, JPG o PNG.");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            alert("El archivo no puede superar los 10 MB.");
            return;
        }

        onChange(file);

    };

    const {
        getRootProps,
        getInputProps,
        isDragActive,
    } = useDropzone({

        multiple: false,

        onDrop: (acceptedFiles) => {

            const file = acceptedFiles[0];

            if (file) {
                handleFile(file);
            }

        },

        accept: {
            "application/pdf": [".pdf"],
            "image/jpeg": [".jpg", ".jpeg"],
            "image/png": [".png"],
        },

    });

    return (

        <Card className="p-5 space-y-4">

            <div>

                <h3 className="font-medium">

                    {label}

                    {required && (
                        <span className="ml-1 text-destructive">
                            *
                        </span>
                    )}

                </h3>

                {description && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}

            </div>

            {!value && (

                <div
                    {...getRootProps()}
                    className={`
                        border-2
                        border-dashed
                        rounded-lg
                        p-8
                        text-center
                        cursor-pointer
                        transition-colors

                        ${isDragActive
                            ? "border-primary bg-primary/5"
                            : "border-muted"
                        }
                    `}
                >

                    <input
                        {...getInputProps()}
                        capture="environment"
                    />

                    <Upload
                        className="
                            mx-auto
                            mb-3
                            size-8
                            text-muted-foreground
                        "
                    />

                    <p className="font-medium">
                        Selecciona un documento
                    </p>

                    <p className="text-xs text-muted-foreground mt-1">
                        Puedes tomar una foto o seleccionar un archivo
                    </p>

                    <p className="text-xs text-muted-foreground">
                        PDF, JPG o PNG · Máximo 10 MB
                    </p>

                </div>

            )}

            {value && (

                <div className="space-y-4">

                    {previewUrl && (

                        <img
                            src={previewUrl}
                            alt="Vista previa"
                            className="
                                h-40
                                w-full
                                rounded-lg
                                object-cover
                                border
                            "
                        />

                    )}

                    <div
                        className="
                            flex
                            items-center
                            gap-3
                        "
                    >

                        {value.type.startsWith("image/")
                            ? <Image className="text-primary" />
                            : <FileText className="text-primary" />
                        }

                        <div className="flex-1">

                            <p className="text-sm font-medium">
                                {value.name}
                            </p>

                            <p className="text-xs text-muted-foreground">
                                {(value.size / 1024 / 1024).toFixed(2)} MB
                            </p>

                            <div
                                className="
                                    flex
                                    items-center
                                    gap-1
                                    mt-1
                                    text-green-600
                                    text-xs
                                "
                            >
                                <CheckCircle size={14} />

                                Documento listo

                            </div>

                        </div>

                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => onChange(null)}
                        >

                            <X />

                        </Button>

                    </div>

                </div>

            )}

        </Card>

    );

}