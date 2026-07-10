import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Crown } from "lucide-react"; // Opcional: Iconos para mejor UX
import type { UserProfile } from "../../types/UserProfile";

// TODO: Revisar como se comporta con el brokerRequestStatus y el verificado, hay errores

type Props = {
    profile: UserProfile;
    loading: boolean;
    onRequest: () => void;
};

export function PremiumSection({ profile, loading, onRequest }: Props) {
    const { account_type, brokerRequestStatus, is_verified, verificationRequestStatus } = profile;

    const hasPendingVerification = verificationRequestStatus === "pending";
    const isPremium = account_type === "premium";
    const isPending = brokerRequestStatus === "pending";
    const canRequest = !isPremium && !isPending && is_verified;

    // Configuración dinámica del botón
    const getButtonConfig = () => {
        if (isPremium) return { text: "Cuenta Activa", variant: "success" };
        if (isPending) return { text: "Verificación pendiente", variant: "pending" };
        if (!is_verified) return { text: "Requiere verificación", variant: "disabled" };
        return { text: "Solicitar acceso", variant: "action" };
    };

    const config = getButtonConfig();

    // Mapeo de estilos para evitar ternarios infinitos en el classname
    const variantStyles = {
        success: "bg-green-100 text-green-700 border-green-200 cursor-default hover:bg-green-100",
        pending: "bg-amber-50 text-amber-700 border-amber-200 cursor-default hover:bg-amber-50",
        disabled: "bg-gray-100 text-gray-400 cursor-not-allowed",
        action: "bg-neutral-800 text-white hover:bg-neutral-900 shadow-sm",
    };

    return (
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">

                <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${isPremium ? 'bg-amber-100' : 'bg-gray-100'}`}>
                        <Crown className={`w-6 h-6 ${isPremium ? 'text-amber-600' : 'text-gray-400'}`} />
                    </div>

                    <div>
                        <h2 className="text-gray-900 font-semibold flex items-center gap-2">
                            Cuenta Premium
                            {isPremium && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        </h2>
                        <p className="text-sm text-gray-500 max-w-sm">
                            {isPremium
                                ? "Disfrutas de todos los beneficios premium. Tu cuenta está activa y verificada."
                                : "Obtén tu cuenta Premium gratis y publica tus propiedades con mayor visibilidad hoy mismo."}
                        </p>
                    </div>
                </div>

                <button
                    onClick={onRequest}
                    disabled={!canRequest || loading}
                    className={`
                        relative flex items-center justify-center gap-2 px-6 py-2.5 
                        text-sm font-medium rounded-md border transition-all duration-200
                        ${variantStyles[config.variant as keyof typeof variantStyles]}
                    `}
                >
                    {isPending && <Clock className="w-4 h-4 animate-pulse" />}
                    {loading ? "Procesando..." : config.text}
                </button>
            </div>

            {/* Footer informativo extra (opcional) */}
            {!isPremium && (
                <>
                    {!is_verified && !hasPendingVerification && (
                        <div className="bg-red-50 px-6 py-2 border-t border-red-100">
                            <p className="text-xs text-red-600">
                                Debes verificar tu identidad antes de solicitar una cuenta Premium.{" "}
                                <a
                                    href="/panel/verification"
                                    className="underline hover:no-underline"
                                >
                                    Verificar ahora
                                </a>
                            </p>
                        </div>
                    )}

                    {hasPendingVerification && (
                        <div className="bg-amber-50 px-6 py-2 border-t border-amber-100">
                            <p className="text-xs text-amber-700">
                                Tu solicitud de verificación fue enviada y está siendo revisada.
                                Una vez aprobada podrás solicitar una cuenta Premium.
                            </p>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}