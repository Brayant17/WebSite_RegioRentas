import { useEffect, useRef, useState } from "react";
import type { FileUploaderProps } from "./FileUploader.types";

export function FileUploader({
    label,
    description,
    file,
    onFileChange,
    capture,
    accept = ["image/jpeg", "image/png", "image/webp"],
    maxSizeMB = 5,
    disabled = false,
    required = false,
    className = "",
}: FileUploaderProps) {

    const inputRef = useRef<HTMLInputElement>(null);

    const [preview, setPreview] = useState<string | null>(null);

    const [error, setError] = useState("");

    useEffect(() => {

        if (!file) {
            setPreview(null);
            return;
        }

        const url = URL.createObjectURL(file);

        setPreview(url);

        return () => URL.revokeObjectURL(url);

    }, [file]);

    const openFilePicker = () => {

        if (disabled) return;

        inputRef.current?.click();

    };

    const validate = (selectedFile: File) => {

        if (!accept.includes(selectedFile.type)) {

            return "Formato no permitido.";

        }

        const maxBytes = maxSizeMB * 1024 * 1024;

        if (selectedFile.size > maxBytes) {

            return `El archivo supera los ${maxSizeMB} MB.`;

        }

        return null;

    };

    const handleChange = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {

        const selectedFile = event.target.files?.[0];

        if (!selectedFile) return;

        const validation = validate(selectedFile);

        if (validation) {

            setError(validation);

            event.target.value = "";

            return;

        }

        setError("");

        onFileChange(selectedFile);

    };

    const removeFile = () => {

        setError("");

        onFileChange(null);

        if (inputRef.current) {

            inputRef.current.value = "";

        }

    };

    return (
        <div className={`rounded-xl border p-5 ${className}`}>

            <label className="block text-sm font-semibold">

                {label}

                {required && (
                    <span className="text-red-500 ml-1">*</span>
                )}

            </label>

            {description && (

                <p className="text-sm text-gray-500 mt-1">

                    {description}

                </p>

            )}

            <input
                ref={inputRef}
                hidden
                type="file"
                accept={accept.join(",")}
                capture={capture ?? undefined}
                onChange={handleChange}
                disabled={disabled}
            />

            {!file && (

                <div className="mt-5 flex flex-col items-center gap-4">

                    <button
                        type="button"
                        onClick={openFilePicker}
                        disabled={disabled}
                        className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
                    >
                        Seleccionar imagen
                    </button>

                    <p className="text-xs text-gray-500">

                        JPG · PNG · WEBP · Máximo {maxSizeMB} MB

                    </p>

                </div>

            )}

            {file && (

                <div className="mt-5 space-y-4">

                    {preview && (

                        <img
                            src={preview}
                            alt={label}
                            className="h-56 w-full rounded-lg object-cover border"
                        />

                    )}

                    <div>

                        <p className="font-medium">

                            {file.name}

                        </p>

                        <p className="text-sm text-gray-500">

                            {(file.size / 1024 / 1024).toFixed(2)} MB

                        </p>

                    </div>

                    <div className="flex gap-3">

                        <button
                            type="button"
                            onClick={openFilePicker}
                            className="rounded-lg border px-4 py-2"
                        >
                            Cambiar
                        </button>

                        <button
                            type="button"
                            onClick={removeFile}
                            className="rounded-lg border border-red-500 px-4 py-2 text-red-600"
                        >
                            Eliminar
                        </button>

                    </div>

                </div>

            )}

            {error && (

                <p className="mt-4 text-sm text-red-500">

                    {error}

                </p>

            )}

        </div>
    );
}