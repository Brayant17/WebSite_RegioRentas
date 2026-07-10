import { useState } from "react";
import { FileUploader } from "@/components/FileUploader/FileUploader";
import { verificationService } from "@/modules/user-panel/services/verification.service";

export default function VerificationPage() {
    const [frontFile, setFrontFile] = useState<File | null>(null);
    const [backFile, setBackFile] = useState<File | null>(null);
    const [selfieFile, setSelfieFile] = useState<File | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async () => {
        setError(null);
        setSuccess(false);

        if (!frontFile || !backFile || !selfieFile) {
            setError("Debes subir todos los documentos.");
            return;
        }

        try {
            setLoading(true);

            await verificationService.submitVerification({
                frontFile,
                backFile,
                selfieFile,
            });

            setSuccess(true);

            setFrontFile(null);
            setBackFile(null);
            setSelfieFile(null);

        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Ocurrió un error al enviar tu solicitud."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-5xl px-6 py-10" >

            <div className="mb-10" >
                <h1 className="text-3xl font-bold" >
                    Verificación de identidad
                </h1>

                < p className="mt-3 text-gray-600" >
                    Para publicar propiedades necesitamos verificar tu identidad.
                    La revisión es manual y normalmente toma menos de 24 horas.
                </p>
            </div>

            < div className="rounded-2xl border bg-white p-8 shadow-sm" >

                <div className="mb-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4" >
                    <h2 className="font-semibold text-yellow-900" >
                        Antes de comenzar
                    </h2>

                    < ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-yellow-800" >
                        <li>La identificación debe estar vigente.</li>
                        < li > Las fotografías deben ser legibles.</li>
                        < li > No cubras ningún dato de la identificación.</li>
                        <li>
                            La selfie debe mostrar claramente tu rostro y la
                            identificación.
                        </li>
                    </ul>
                </div>

                < div className="grid gap-6 lg:grid-cols-2" >

                    <FileUploader
                        label="INE - Frente"
                        description="Fotografía el frente de tu identificación."
                        file={frontFile}
                        onFileChange={setFrontFile}
                        capture="environment"
                        required
                    />

                    <FileUploader
                        label="INE - Reverso"
                        description="Fotografía el reverso de tu identificación."
                        file={backFile}
                        onFileChange={setBackFile}
                        capture="environment"
                        required
                    />

                </div>

                < div className="mt-6" >

                    <FileUploader
                        label="Selfie con identificación"
                        description="Sostén tu identificación junto a tu rostro. Asegúrate de que ambos sean visibles."
                        file={selfieFile}
                        onFileChange={setSelfieFile}
                        capture="user"
                        required
                    />

                </div>

                {
                    error && (
                        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" >
                            {error}
                        </div>
                    )
                }

                {
                    success && (
                        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700" >
                            Tu solicitud fue enviada correctamente.En cuanto sea revisada recibirás una notificación.
                        </div>
                    )
                }

                <div className="mt-8 flex justify-end" >

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={
                            loading ||
                            !frontFile ||
                            !backFile ||
                            !selfieFile
                        }
                        className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {
                            loading
                                ? "Enviando solicitud..."
                                : "Enviar solicitud"
                        }
                    </button>

                </div>

            </div>

        </div>
    );
}