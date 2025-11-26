import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ConfigUser() {
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [toastError, setToastError] = useState({
        error: false,
        message: '',
    })
    const [loading, setLoading] = useState(true);
    const [whatsappError, setWhatsappError] = useState("");
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        whatsapp: "",
        avatar: "",
        broker: null,
    });

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        setLoading(true);
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error("No se encontró usuario autenticado:", userError);
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from("users")
            .select("full_name, email, avatar_url, approval_status, whatsapp")
            .eq("id", user.id)
            .single();

        if (error) {
            console.error("Error al traer datos del usuario:", error);
        } else {
            setFormData((prev) => ({
                ...prev,
                name: data.full_name || "",
                email: data.email || "",
                avatar: data.avatar_url || "",
                broker: data.approval_status ?? null,
                whatsapp: data.whatsapp || "",
            }));
        }
        setLoading(false);
    };

    const solicitarBroker = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        const { error } = await supabase
            .from("users")
            .update({ approval_status: "pending" })
            .eq("id", user.id);

        if (error) {
            alert("Error al solicitar el cambio.");
        } else {
            fetchUserData();
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const whatsappRegex = /^[+]?[\d\s()-]{7,20}$/;

        if (!formData.whatsapp.trim()) {
            setToastError.error = true
            setToastError({ error: true, message: "Por favor ingresa un número de WhatsApp válido." });
            setTimeout(() => setToastError({ error: false, message: "" }), 3000);
            return;
        }

        if (!whatsappRegex.test(formData.whatsapp)) {
            setToastError({ error: true, message: "El número de WhatsApp no tiene un formato válido. Ejemplo: +52 818281822" });
            setTimeout(() => setToastError({ error: false, message: "" }), 3000);
            return;
        }

        setLoading(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        const { error } = await supabase
            .from("users")
            .update({
                full_name: formData.name,
                whatsapp: formData.whatsapp.trim(),
            })
            .eq("id", user.id);

        if (error) {
            console.error("Error al actualizar:", error);
            alert("Hubo un error al guardar los cambios.");
        }

        setLoading(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
    };


    return (
        <div className="flex flex-col gap-4">
            {/* --- Sección Perfil --- */}
            <section className="bg-gray-100 rounded-md shadow-sm">
                <header className="border-b border-gray-300 py-4 px-6">
                    <h2 className="text-gray-700 font-semibold">Información del perfil</h2>
                </header>

                <form onSubmit={handleSubmit} className="p-4 flex flex-col md:flex-row gap-6">
                    {/* Avatar */}
                    <div className="w-20 h-20 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
                        {formData.avatar ? (
                            <img
                                src={formData.avatar}
                                alt="Foto de perfil"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <p className="text-gray-600 font-semibold text-xl">
                                {formData.name ? formData.name.charAt(0).toUpperCase() : "?"}
                            </p>
                        )}
                    </div>

                    {/* Datos del usuario */}
                    <div className="flex-1">
                        <div className="p-2">
                            <label className="text-sm block mb-1">Nombre Completo</label>
                            <input
                                name="name"
                                type="text"
                                value={formData.name}
                                onChange={handleChange}
                                disabled={loading}
                                className="block w-full text-sm border border-gray-500 px-3 py-2 rounded-md"
                            />
                        </div>

                        <div className="p-2">
                            <label className="text-sm block mb-1">Correo</label>
                            <input
                                name="email"
                                type="email"
                                value={formData.email}
                                disabled
                                className="block w-full text-sm border border-gray-500 px-3 py-2 rounded-md bg-gray-100"
                            />
                        </div>

                        <div className="p-2">
                            <label className="text-sm block mb-1">WhatsApp</label>
                            <input
                                name="whatsapp"
                                type="text"
                                value={formData.whatsapp}
                                onChange={(e) => {
                                    handleChange(e);
                                    const regex = /^[+]?[\d\s()-]{7,20}$/;
                                    if (e.target.value && !regex.test(e.target.value)) {
                                        setWhatsappError("Formato inválido (ej: +52 818281822)");
                                    } else {
                                        setWhatsappError("");
                                    }
                                }}
                                disabled={loading}
                                className={`block w-full text-sm border px-3 py-2 rounded-md ${whatsappError ? "border-red-500" : "border-gray-500"
                                    }`}
                            />
                            {whatsappError && <p className="text-xs text-red-500 mt-1">{whatsappError}</p>}
                            <span className="text-xs text-gray-500">
                                Este número se mostrará en el botón de WhatsApp de tus propiedades.
                            </span>
                        </div>
                    </div>
                </form>

                <footer className="border-t flex justify-end border-gray-300 py-4 px-6">
                    <button
                        type="submit"
                        disabled={loading}
                        onClick={handleSubmit}
                        className={`px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-900 duration-300 rounded-md text-white cursor-pointer disabled:opacity-60 ${loading ? "cursor-not-allowed" : ""
                            }`}
                    >
                        {loading ? "Guardando..." : "Guardar"}
                    </button>
                </footer>
            </section>

            {/* --- Sección Broker --- */}
            <section className="bg-gray-100 rounded-md shadow-sm">
                <header className="border-b border-gray-300 py-4 px-6">
                    <h2 className="text-gray-700 text-base font-medium">Premium</h2>
                    <p className="text-sm text-gray-600">
                        Obtén tu cuenta Premium gratis y publica tus propiedades hoy mismo.
                    </p>
                </header>

                <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="p-2">
                        <h3 className="text-base">
                            {formData.broker === "approved"
                                ? "Cuenta de premium activa ✅"
                                : "Cuenta de premium no activa"}
                        </h3>
                        <p className="text-sm">
                            {formData.broker === "approved"
                                ? "Ya puedes publicar tus propiedades en la plataforma."
                                : "Solicita la activación de tu cuenta Premium para comenzar a publicar."}
                            {formData.broker === "pending" && (
                                <span className="text-sm text-yellow-600 ml-2">
                                    Solicitud en revisión ⏳
                                </span>
                            )}
                        </p>
                    </div>

                    <button
                        onClick={solicitarBroker}
                        disabled={!!formData.broker}
                        className={`px-3 py-1.5 text-sm md:text-base rounded text-white cursor-pointer transition ${formData.broker === "approved"
                            ? "bg-green-600 cursor-not-allowed"
                            : formData.broker === "pending"
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-neutral-700 hover:bg-neutral-900"
                            }`}
                    >
                        {formData.broker === "approved"
                            ? "Activo"
                            : formData.broker === "pending"
                                ? "En revisión ⏳"
                                : "Solicitar acceso"}
                    </button>
                </div>
            </section>

            {/* --- Toast de guardado --- */}
            {saveSuccess && (
                <div className="fixed bottom-3 right-1/2 translate-x-1/2 md:right-5 md:translate-x-0 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-fade-in">
                    ✅ Configuración guardada correctamente
                </div>
            )}
            {toastError.error && (
                <div className="fixed bottom-3 right-1/2 translate-x-1/2 md:right-5 md:translate-x-0 bg-red-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-fade-in">
                    {toastError.message}
                </div>
            )}
        </div>
    );
}
