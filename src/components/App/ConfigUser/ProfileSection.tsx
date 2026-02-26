import { useEffect, useState, useMemo } from "react";
import type { UserProfile } from "./hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type Props = {
    profile: UserProfile;
    loading: boolean;
    onSave: (name: string, whatsapp: string) => void;
};

export function ProfileSection({ profile, loading, onSave }: Props) {
    const [formData, setFormData] = useState({
        fullName: profile.full_name || "",
        whatsapp: profile.whatsapp || "",
    });

    // Actualizar estado si el perfil cambia externamente
    useEffect(() => {
        setFormData({
            fullName: profile.full_name || "",
            whatsapp: profile.whatsapp || "",
        });
    }, [profile]);

    // Verificar si hay cambios para habilitar/deshabilitar el botón
    const isDirty = useMemo(() => {
        return (
            formData.fullName !== profile.full_name ||
            formData.whatsapp !== profile.whatsapp
        );
    }, [formData, profile]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isDirty || loading) return;
        onSave(formData.fullName, formData.whatsapp);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const initials = profile.full_name
        ? profile.full_name.trim().charAt(0).toUpperCase()
        : "?";

    return (
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <header className="border-b border-gray-100 py-4 px-6 bg-gray-50/50">
                <h2 className="text-lg text-gray-800 font-semibold">Información del perfil</h2>
                <p className="text-sm text-gray-500">Actualiza tu información personal y de contacto.</p>
            </header>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Avatar Section */}
                <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-primary/10 rounded-full overflow-hidden flex items-center justify-center border-2 border-white shadow-md">
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-primary font-bold text-2xl">{initials}</span>
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-700">Foto de perfil</p>
                        <p className="text-xs text-gray-500">Sincronizada con tu cuenta.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Nombre Completo */}
                    <div className="space-y-1.5">
                        <label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                            Nombre Completo
                        </label>
                        <input
                            id="fullName"
                            name="fullName"
                            type="text"
                            value={formData.fullName}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="Ej. Juan Pérez"
                            className="w-full text-sm border border-gray-300 px-3 py-2 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
                        />
                    </div>

                    {/* Email (Read Only) */}
                    <div className="space-y-1.5">
                        <label htmlFor="email" className="text-sm font-medium text-gray-700">
                            Correo Electrónico
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={profile.email}
                            disabled
                            className="w-full text-sm border border-gray-200 px-3 py-2 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                    </div>

                    {/* WhatsApp */}
                    <div className="md:col-span-2 space-y-1.5">
                        <label htmlFor="whatsapp" className="text-sm font-medium text-gray-700">
                            WhatsApp
                        </label>
                        <input
                            id="whatsapp"
                            name="whatsapp"
                            type="tel"
                            value={formData.whatsapp}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="+52..."
                            className="w-full text-sm border border-gray-300 px-3 py-2 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
                        />
                        <p className="text-[11px] text-gray-500 italic">
                            * Este número se mostrará en el botón de contacto de tus propiedades.
                        </p>
                    </div>
                </div>

                <footer className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                    <Button
                        type="submit"
                        disabled={loading || !isDirty}
                        className="min-w-[120px]"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <Spinner className="h-4 w-4" /> Guardando...
                            </span>
                        ) : (
                            "Guardar cambios"
                        )}
                    </Button>
                </footer>
            </form>
        </section>
    );
}